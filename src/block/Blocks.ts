import {Vec} from "../math/Vec";
import * as THREE from "three";
import {Levels} from "../world/Levels";
import {Textures} from "./Textures";
import {Directions} from "../math/Directions";

export namespace Blocks {
    import Level = Levels.Level;
    import Direction = Directions.Direction;
    import MaterialConfig = Textures.MaterialConfig;

    export class Block {
        static readonly BLOCK_SIZE: number = 1;
        public static readonly BLOCKS: Block[] = [];
        protected static readonly TEXTURES: string = "assets/textures/";

        public index: number;
        public registryName: String;

        constructor(registryName: String) {
            this.index = Block.BLOCKS.length;
            this.registryName = registryName;
            Block.BLOCKS.push(this);
        }

        get shouldRender() {
            return true;
        }

        public prepare(scene: THREE.Scene) {

        }

        public tick(state: BlockState, pos: Vec.BlockPos, level: Level) {
        }

        public update(state: BlockState, level: Level, pos: Vec.BlockPos, updateState: BlockState, updatePos: Vec.BlockPos, updateDirection: Direction) {

        }

        public remove(scene: THREE.Scene) {

        }

        public load(scene: THREE.Scene, state: BlockState, level: Level, pos: Vec.BlockPos, faces: Map<Direction, boolean>) {
        }

        public unload(scene: THREE.Scene, state: BlockState, level: Level, pos: Vec.BlockPos, index: number) {

        }

        public getTexture(direction: Direction): Textures.Texture {
            return null;
        }
    }

    export class TexturedBlock extends Block {
        public texture: Textures.Texture;

        constructor(registryName: String, texture: Textures.Texture) {
            super(registryName);
            this.texture = texture;
        }

        getTexture(direction: Directions.Direction): Textures.Texture {
            return this.texture;
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

        getTexture(direction: Directions.Direction): Textures.Texture {
            if (direction == Direction.UP) {
                return Textures.T_GRASS_BLOCK_TOP;
            } else if (direction == Direction.DOWN) {
                return Textures.T_DIRT;
            }
            return Textures.T_GRASS_BLOCK_SIDE;
        }
    }

    export class BlockState {
        public readonly block: Block;
        public readonly pos: Vec.BlockPos;
        public level: Level;
        public chunk: Levels.Chunk;
        public relativePos: Vec.BlockPos;
        public index: number;

        public render: Levels.ChunkRenderer;
        public faces: Map<Direction, boolean> = new Map<Directions.Direction, boolean>();

        constructor(block: Blocks.Block, pos: Vec.BlockPos) {
            this.block = block;
            this.pos = pos;
        }

        public static deserialize(data: { block: number, pos: { x: number, y: number, z: number }, faces: { direction: number, value: boolean }[] }): BlockState {
            let block = Block.BLOCKS[data.block];
            let pos = new Vec.BlockPos(data.pos.x, data.pos.y, data.pos.z);
            let faces = new Map<Direction, boolean>();
            for (let face of data.faces) {
                let dir = Direction.values[face.direction];
                faces.set(dir, face.value);
            }

            let instance = new BlockState(block, pos);
            instance.faces = faces;
            return instance;
        }

        public setupLevel(level: Level, chunk: Levels.Chunk, renderer: Levels.ChunkRenderer) {
            this.level = level;
            this.chunk = chunk;
            this.render = renderer;

            if (chunk != null) {
                let relX = (this.pos.x - (chunk.chunkPos.x * Levels.Chunk.CHUNK_SIZE))
                let relZ = (this.pos.z - (chunk.chunkPos.z * Levels.Chunk.CHUNK_SIZE))

                this.relativePos = new Vec.BlockPos(relX, this.pos.y, relZ);

                // 3d -> 1d ===> (z * xMax * yMax) + (y * xMax) + x
                this.index = ((relZ * Levels.Chunk.CHUNK_SIZE * Levels.Chunk.CHUNK_DEPTH) + (this.pos.y * Levels.Chunk.CHUNK_SIZE) + relX) * 6;
            }
        }

        public stringFaces(): string {
            let s = "";
            this.faces.forEach((face, dir) => s += dir.name.charAt(0) + ": " + face + " | ");
            return s;
        }

        public load(scene: THREE.Scene) {
        }

        public unload(scene: THREE.Scene) {
        }

        public onPlace(neighbours: { direction: Direction, state: BlockState }[]) {
            neighbours.forEach((neighbour) => {
                this.faces.set(neighbour.direction, neighbour.state.block == Blocks.AIR);
            });

            if (this.pos.y == 0) {
                this.faces.set(Direction.DOWN, false);
            }

            if (this.render) {
                this.faces.forEach((face) => {
                    if (face) {
                        this.render.planes++;
                    }
                })


                this.updateMesh();
            }
        }

        public remove(scene: THREE.Scene) {
            this.unload(scene);
            this.block.remove(scene);
        }

        public tick() {
            this.block.tick(this, this.pos, this.level);
        }

        public update(updateState: BlockState, updatePos: Vec.BlockPos, updateDirection: Direction) {
            let needsFace = updateState.block == Blocks.AIR;
            let oldValue = this.faces.get(updateDirection);
            if (needsFace != oldValue) {
                this.faces.set(updateDirection, needsFace);
                if (this.render) {
                    if (needsFace) {
                        this.render.planes++;
                    } else {
                        this.render.planes--;
                    }
                }
            }

            this.block.update(this, this.level, this.pos, updateState, updatePos, updateDirection);
            if (this.render) {
                this.updateMesh();
            }
        }

        public updateMesh() {
            let pos = this.relativePos;

            for (let i = 0; i < Direction.values.length; i++) {
                let dir = Direction.values[i];

                if (this.faces.get(dir)) {
                    let matrix = new THREE.Matrix4();
                    if (dir == Direction.UP) {
                        matrix.makeRotationX(Math.PI / 2)
                        matrix.setPosition(pos.x, pos.y + 0.5, pos.z);
                    } else if (dir == Direction.DOWN) {
                        matrix.makeRotationX(-Math.PI + Math.PI / 2)
                        matrix.setPosition(pos.x, pos.y - 0.5, pos.z);
                    } else if (dir == Direction.NORTH) {
                        matrix.setPosition(pos.x, pos.y, pos.z - 0.5);
                    } else if (dir == Direction.SOUTH) {
                        matrix.makeRotationY(-Math.PI)
                        matrix.setPosition(pos.x, pos.y, pos.z + 0.5);
                    } else if (dir == Direction.EAST) {
                        matrix.makeRotationY(-Math.PI + (Math.PI / 2))
                        matrix.setPosition(pos.x + 0.5, pos.y, pos.z);
                    } else if (dir == Direction.WEST) {
                        matrix.makeRotationY(Math.PI / 2)
                        matrix.setPosition(pos.x - 0.5, pos.y, pos.z);
                    }

                    let texMatrix = new Levels.MatrixTexture(matrix, this.block.getTexture(dir));

                    this.render.setMatrixAt(this.index + i, texMatrix);
                } else {
                    this.render.removeMatrixAt(this.index + i);
                }
            }

            this.render.updateMesh();
        }

        public serialize(): any {
            let faces = [];
            this.faces.forEach((value, dir) => {
                faces.push({
                    direction: Direction.values.indexOf(dir),
                    value: value
                })
            })
            return {
                block: this.block.index,
                pos: {
                    x: this.pos.x,
                    y: this.pos.y,
                    z: this.pos.z
                },
                faces: faces
            }
        }
    }

    //! ------------------------------------------------

    export const AIR: Block = new AirBlock("air");
    export const STONE: Block = new TexturedBlock("stone", Textures.T_STONE);
    export const GRASS_BLOCK: Block = new GrassBlock("grass_block", () => DIRT);
    export const DIRT: Block = new TexturedBlock("dirt", Textures.T_DIRT);

    //! ------------------------------------------------
}