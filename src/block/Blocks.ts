import {Vec} from "../math/Vec";
import * as THREE from "three";
import {InstancedMesh} from "three";
import {Levels} from "../world/Levels";
import {Textures} from "./Textures";
import {Directions} from "../math/Directions";

export namespace Blocks {
    import BlockPos = Vec.BlockPos;
    import Level = Levels.Level;
    import Direction = Directions.Direction;
    import MaterialConfig = Textures.MaterialConfig;

    export class Block {
        static readonly BLOCK_SIZE: number = 1;
        private static readonly CUBE_GEOMETRY = new THREE.PlaneBufferGeometry(Block.BLOCK_SIZE, Block.BLOCK_SIZE);
        public static readonly BLOCKS: Block[] = [];
        protected static readonly TEXTURES: string = "assets/textures/";
        public static readonly FREE_MESH_INDEXES: number[] = [];
        public static MESH_INDEX: number = 0;
        public static MESH_COUNT: number;
        protected static NULL_MATRIX: THREE.Matrix4 = new THREE.Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

        public static setup(chunkSize: number, chunkDepth: number, renderDistance: number) {
            this.MESH_COUNT = (chunkSize * chunkSize) * chunkDepth * (renderDistance * renderDistance);
        }

        protected static getNextIndex(): number {
            if (this.FREE_MESH_INDEXES.length == 0) {
                return this.MESH_INDEX++;
            }

            let value = this.FREE_MESH_INDEXES[0];

            this.FREE_MESH_INDEXES.splice(0, 1);
            return value;
        }

        public registryName: String;
        public geometry: THREE.PlaneGeometry;
        public meshes: { direction: Direction, mesh: InstancedMesh }[] = [];

        constructor(registryName: String) {
            this.registryName = registryName;
            Block.BLOCKS.push(this);
        }

        public prepare(scene: THREE.Scene) {
            this.geometry = Block.CUBE_GEOMETRY;

            if (this.shouldRender) {
                let config = this.createMaterials();
                Direction.values.forEach(dir => {
                    let mesh = new InstancedMesh(this.geometry, config.get(dir), Block.MESH_COUNT);
                    mesh.matrixAutoUpdate = false;
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                    scene.add(mesh);
                    this.meshes.push({
                        direction: dir,
                        mesh: mesh
                    })
                });
            }
        }

        public tick(state: BlockState, pos: BlockPos, level: Level) {
        }

        public createMaterials(): MaterialConfig {
            return Textures.MaterialHelper.makeFullCube(Block.TEXTURES + "blocks/" + this.registryName + ".png");
        }

        public update(state: BlockState, level: Level, pos: BlockPos, updateState: BlockState, updatePos: BlockPos, updateDirection: Direction) {

        }

        public remove(scene: THREE.Scene) {

        }

        public load(scene: THREE.Scene, state: BlockState, level: Level, pos: BlockPos, faces: Map<Direction, boolean>): number {
            let index = Block.getNextIndex();

            faces.forEach((value, direction) => {
                let mesh = this.getMesh(direction);
                if (mesh == null) {
                    return
                }
                if (!value) {
                    mesh.setMatrixAt(index, Block.NULL_MATRIX);
                } else {
                    let matrix = new THREE.Matrix4();
                    if(direction == Direction.UP) {
                        matrix.makeRotationX(Math.PI / 2)
                        matrix.setPosition(pos.x, pos.y + 0.5, pos.z);
                    }else if(direction == Direction.DOWN){
                        matrix.makeRotationX(-Math.PI + Math.PI / 2)
                        matrix.setPosition(pos.x, pos.y - 0.5, pos.z);
                    }else if(direction == Direction.NORTH){
                        matrix.setPosition(pos.x, pos.y, pos.z - 0.5);
                    }else if(direction == Direction.SOUTH){
                        matrix.makeRotationY(-Math.PI)
                        matrix.setPosition(pos.x, pos.y, pos.z + 0.5);
                    }else if(direction == Direction.EAST){
                        matrix.makeRotationY(-Math.PI + (Math.PI / 2))
                        matrix.setPosition(pos.x + 0.5, pos.y, pos.z);
                    }else if(direction == Direction.WEST){
                        matrix.makeRotationY(Math.PI / 2)
                        matrix.setPosition(pos.x - 0.5, pos.y, pos.z);
                    }

                    mesh.setMatrixAt(index, matrix);
                }
                mesh.instanceMatrix.needsUpdate = true;
            })

            return index;
        }

        public unload(scene: THREE.Scene, state: BlockState, level: Level, pos: BlockPos, index: number) {
            Block.FREE_MESH_INDEXES.push(index);
            this.meshes.forEach(mesh => mesh.mesh.setMatrixAt(index, Block.NULL_MATRIX))
        }

        get shouldRender() {
            return true;
        }

        getMesh(direction: Direction): THREE.InstancedMesh {
            for (let mesh of this.meshes) {
                if (mesh.direction == direction) {
                    return mesh.mesh;
                }
            }
            return null;
        }
    }

    class AirBlock extends Block {
        get shouldRender() {
            return false;
        }

        public createMaterials(): MaterialConfig {
            return null;
        }
    }

    class GrassBlock extends Block {
        private dirt: () => Block;

        constructor(registryName: String, dirt: () => Blocks.Block) {
            super(registryName);
            this.dirt = dirt;
        }

        public createMaterials(): MaterialConfig {
            return Textures.MaterialHelper.makeTopSideBottom(
                Block.TEXTURES + "blocks/" + this.registryName + "_top.png",
                Block.TEXTURES + "blocks/" + this.registryName + "_side.png",
                Block.TEXTURES + "blocks/" + this.dirt().registryName + ".png"
            );
        }
    }

    export class BlockState {
        public readonly block: Block;
        public readonly pos: BlockPos;
        public readonly level: Level;

        protected objects: THREE.Object3D[] = [];
        public mesh: THREE.Mesh;
        protected faces: Map<Direction, boolean> = new Map<Directions.Direction, boolean>();

        public meshIndex: number;

        constructor(block: Blocks.Block, pos: Vec.BlockPos, level: Level) {
            this.block = block;
            this.pos = pos;
            this.level = level;

            Direction.values.forEach((dir) => this.faces.set(dir, true));
        }

        public stringFaces(): string {
            let s = "";
            this.faces.forEach((face, dir) => s += dir.name.charAt(0) + ": " + face + " | ");
            return s;
        }

        public load(scene: THREE.Scene) {
            if (this.meshIndex == null) {
                this.meshIndex = this.block.load(scene, this, this.level, this.pos, this.faces);
            }
        }

        public unload(scene: THREE.Scene) {
            if (this.meshIndex != null) {
                this.block.unload(scene, this, this.level, this.pos, this.meshIndex);
                this.meshIndex = null;
            }
        }

        public onPlace(neighbours: { direction: Direction, state: BlockState }[]) {
            neighbours.forEach((neighbour) => {
                this.faces.set(neighbour.direction, neighbour.state.block == Blocks.AIR);
            });

            if(this.pos.y == 0){
                this.faces.set(Direction.DOWN,false);
            }
        }

        public remove(scene: THREE.Scene) {
            this.unload(scene);
            this.objects = [];
            this.block.remove(scene);
        }

        public tick() {
            this.block.tick(this, this.pos, this.level);
        }

        public update(updateState: BlockState, updatePos: BlockPos, updateDirection: Direction) {
            let needsFace = updateState.block == Blocks.AIR;
            let oldValue = this.faces.get(updateDirection);
            if (needsFace != oldValue) {
                this.faces.set(updateDirection, needsFace);
            }

            this.block.update(this, this.level, this.pos, updateState, updatePos, updateDirection);
        }
    }

    //! ------------------------------------------------

    export const AIR: Block = new AirBlock("air");
    export const STONE: Block = new Block("stone");
    export const GRASS_BLOCK: Block = new GrassBlock("grass_block", () => DIRT);
    export const DIRT: Block = new Block("dirt");

    //! ------------------------------------------------
}