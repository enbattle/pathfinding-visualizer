import {
  AmbientLight,
  CatmullRomCurve3,
  Color,
  DirectionalLight,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { isRevealed, type Run } from '../../visualizer/runs';
import type { VisualizerSnapshot } from '../../visualizer/visualizer';
import { cellLayer, type BoardPalette } from '../board-renderer';
import { cellPose, HEIGHTS } from './cell-pose';

/** Whether this browser can create a WebGL context at all. */
export function supportsWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') ?? probe.getContext('webgl');
    // Free the probe's context right away (browsers cap live contexts).
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return Boolean(gl);
  } catch {
    return false;
  }
}

const CELL_FOOTPRINT = 0.9; // box width relative to its cell
const TUBE_RADIUS = 0.11;
const TUBE_LIFT = 0.28; // how far above the path cells the tube floats

/**
 * The board as a 3D scene: one instanced rounded box per cell (a single
 * draw call for the whole board), a floor, lights, and a tube tracing the
 * found path. `update()` poses every box from the same cellLayer() the 2D
 * renderer uses, so it's a pure function of (snapshot, run, tick) too -
 * scrubbing works identically in both views.
 */
export class BoardScene {
  readonly camera: PerspectiveCamera;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly cells: InstancedMesh;
  private readonly tubeMaterial: MeshStandardMaterial;
  private tube: Mesh<TubeGeometry, MeshStandardMaterial> | null = null;
  private tubeKey = '';
  private readonly colors = new Map<string, Color>();
  private readonly matrix = new Matrix4();
  private readonly disposables: { dispose(): void }[] = [];

  constructor(
    canvas: HTMLCanvasElement,
    private readonly rows: number,
    private readonly columns: number,
    private readonly palette: BoardPalette,
    private readonly options: { reducedMotion: boolean }
  ) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;

    const span = Math.max(rows, columns);
    this.camera = new PerspectiveCamera(38, 1, 0.1, span * 10);
    // Three-quarter view from the "south", looking at the board center.
    this.camera.position.set(0, span * 0.95, span * 0.85);
    this.camera.lookAt(0, 0, 0);

    this.scene.add(new HemisphereLight(0xdfe8ff, 0x0b0e14, 1.4));
    this.scene.add(new AmbientLight(0xffffff, 0.25));
    const sun = new DirectionalLight(0xffffff, 2.2);
    sun.position.set(-columns * 0.35, span * 0.9, rows * 0.55);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const reach = span * 0.75;
    Object.assign(sun.shadow.camera, {
      left: -reach,
      right: reach,
      top: reach,
      bottom: -reach,
      near: 0.5,
      far: span * 3,
    });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);

    const floorGeometry = new PlaneGeometry(columns + 0.6, rows + 0.6);
    const floorMaterial = new MeshStandardMaterial({
      color: this.color(palette.gridLine),
      roughness: 0.95,
    });
    const floor = new Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const boxGeometry = new RoundedBoxGeometry(1, 1, 1, 2, 0.12);
    // Anchor boxes at their base, so scaling y grows them upward.
    boxGeometry.translate(0, 0.5, 0);
    const boxMaterial = new MeshStandardMaterial({
      roughness: 0.5,
      metalness: 0.05,
    });
    this.cells = new InstancedMesh(boxGeometry, boxMaterial, rows * columns);
    this.cells.castShadow = true;
    this.cells.receiveShadow = true;
    this.scene.add(this.cells);

    this.tubeMaterial = new MeshStandardMaterial({
      color: this.color(palette.pathLine),
      emissive: this.color(palette.pathGlow),
      emissiveIntensity: 1.6,
      roughness: 0.3,
    });

    this.disposables.push(
      floorGeometry,
      floorMaterial,
      boxGeometry,
      boxMaterial,
      this.tubeMaterial
    );
  }

  /** Poses every cell (and the path tube) for playhead `tick`. */
  update(
    snapshot: VisualizerSnapshot,
    run: Run | null,
    tick: number,
    animationTicks: number
  ): void {
    const { rows, columns } = this;
    for (let index = 0; index < rows * columns; index++) {
      const layer = cellLayer(snapshot, run, index, tick, animationTicks);
      const { height, color } = cellPose(layer, this.palette, this.options);
      const column = index % columns;
      const row = (index - column) / columns;
      this.matrix.makeScale(CELL_FOOTPRINT, height, CELL_FOOTPRINT);
      this.matrix.setPosition(
        column - columns / 2 + 0.5,
        0,
        row - rows / 2 + 0.5
      );
      this.cells.setMatrixAt(index, this.matrix);
      this.cells.setColorAt(index, this.color(color));
    }
    this.cells.instanceMatrix.needsUpdate = true;
    if (this.cells.instanceColor) this.cells.instanceColor.needsUpdate = true;
    this.updateTube(snapshot, run, tick);
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.frameBoard();
  }

  // Moves the camera, along its current viewing direction, to the closest
  // distance at which every corner of the board (walls included) projects
  // inside the viewport. Perspective makes the near edge look wider than
  // the far one, so this projects the real corners rather than estimating;
  // fits are monotonic in distance, so a binary search finds it.
  private frameBoard(): void {
    const { camera, rows, columns } = this;
    const direction = camera.position.clone().normalize();
    const corners: Vector3[] = [];
    for (const x of [-columns / 2, columns / 2]) {
      for (const z of [-rows / 2, rows / 2]) {
        for (const y of [0, HEIGHTS.wall]) corners.push(new Vector3(x, y, z));
      }
    }
    const MARGIN = 0.94; // of the viewport, in normalized device coordinates
    const fits = (distance: number) => {
      camera.position.copy(direction).multiplyScalar(distance);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      return corners.every(corner => {
        const p = corner.clone().project(camera);
        return Math.abs(p.x) <= MARGIN && Math.abs(p.y) <= MARGIN;
      });
    };
    const span = Math.max(rows, columns);
    let near = span * 0.1;
    let far = span * 8;
    for (let i = 0; i < 30; i++) {
      const middle = (near + far) / 2;
      if (fits(middle)) far = middle;
      else near = middle;
    }
    fits(far);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.tube?.geometry.dispose();
    for (const item of this.disposables) item.dispose();
    this.cells.dispose();
    this.renderer.dispose();
    // Release the WebGL context now rather than whenever it's collected:
    // browsers cap live contexts (~16), so toggling 2D/3D repeatedly would
    // otherwise start evicting the oldest ones.
    this.renderer.forceContextLoss();
  }

  // The revealed prefix of the path as a tube, rebuilt only when the
  // revealed length (or the path itself) changes.
  private updateTube(
    snapshot: VisualizerSnapshot,
    run: Run | null,
    tick: number
  ): void {
    const path = run?.kind === 'search' ? run.result.path : null;
    let revealed = 0;
    if (run?.kind === 'search' && path && path.length > 1) {
      revealed = 1;
      for (let i = 1; i < path.length; i++) {
        const isGoal = i === path.length - 1;
        if (!isGoal && !isRevealed(run.pathTick[path[i]], tick)) break;
        if (isGoal && tick < run.length) break;
        revealed = i + 1;
      }
    }
    const key =
      revealed >= 2 && path
        ? `${snapshot.version}:${path.length}:${revealed}`
        : '';
    if (key === this.tubeKey) return;
    this.tubeKey = key;

    if (this.tube) {
      this.scene.remove(this.tube);
      this.tube.geometry.dispose();
      this.tube = null;
    }
    if (!key || !path) return;

    const { rows, columns } = this;
    const y = HEIGHTS.path + TUBE_LIFT;
    const points = path.slice(0, revealed).map(index => {
      const column = index % columns;
      const row = (index - column) / columns;
      return new Vector3(column - columns / 2 + 0.5, y, row - rows / 2 + 0.5);
    });
    // A low-tension centripetal curve keeps grid corners crisp, just rounded.
    const curve = new CatmullRomCurve3(points, false, 'centripetal', 0.2);
    const geometry = new TubeGeometry(
      curve,
      Math.max(8, points.length * 6),
      TUBE_RADIUS,
      10,
      false
    );
    this.tube = new Mesh(geometry, this.tubeMaterial);
    this.tube.castShadow = true;
    this.scene.add(this.tube);
  }

  // three.js Colors cached per CSS color string (cellPose quantizes colors,
  // so there are only a few dozen distinct ones).
  private color(css: string): Color {
    let color = this.colors.get(css);
    if (!color) this.colors.set(css, (color = new Color(css)));
    return color;
  }
}
