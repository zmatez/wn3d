import {Blocks} from "../block/Blocks";
import {Vec} from "../math/Vec";
import * as THREE from "three";
import {Directions} from "../math/Directions";
import SimplexNoise from "simplex-noise";
import {Textures} from "../block/Textures";

export namespace Levels {

    import BlockState = Blocks.BlockState;
    import BlockPos = Vec.BlockPos;
    import Block = Blocks.Block;
    import ChunkPos = Vec.ChunkPos;
    import Direction = Directions.Direction;

    export class Chunk {
        public static readonly CHUNK_SIZE: number = 16;
        public static readonly CHUNK_DEPTH: number = 32;
        static readonly EMPTY_MATRIX: THREE.Matrix4 = new THREE.Matrix4().scale(new THREE.Vector3(0,0,0));
        public readonly blocks: Map<string, BlockState> = new Map<string, Blocks.BlockState>();
        private readonly level: Level;
        public readonly chunkPos: ChunkPos;
        public loaded = false;
        public mesh: THREE.InstancedMesh;
        public lastIndex = 0;

        constructor(level: Level, chunkPos: Vec.ChunkPos) {
            this.level = level;
            this.chunkPos = chunkPos;

            this.mesh = new THREE.InstancedMesh(Blocks.Block.CUBE_GEOMETRY, Textures.material, Chunk.CHUNK_SIZE * Chunk.CHUNK_SIZE * Chunk.CHUNK_DEPTH * 6); //6 faces
            this.mesh.position.x = chunkPos.x * Chunk.CHUNK_SIZE;
            this.mesh.position.z = chunkPos.z * Chunk.CHUNK_SIZE;
        }

        public setBlock(pos: BlockPos, block: Block): void {
            let serial = pos.serialize();
            if (this.blocks.has(serial)) {
                this.blocks.get(serial).remove(this.level.scene);
            }

            let relX = (pos.x - (this.chunkPos.x * Chunk.CHUNK_SIZE))
            let relZ = (pos.z - (this.chunkPos.z * Chunk.CHUNK_SIZE))

            // 3d -> 1d ===> (z * xMax * yMax) + (y * xMax) + x
            let index = ((relZ * Chunk.CHUNK_SIZE * Chunk.CHUNK_DEPTH) + (pos.y * Chunk.CHUNK_SIZE) + relX) * 6;

            if (block == Blocks.AIR) {
                this.blocks.delete(serial);
                let state = new Blocks.BlockState(Blocks.AIR, pos, this.level, this, this.mesh, index);
                this.level.getNeighbour(pos).forEach(neighbour => {
                    if (neighbour.state.block != Blocks.AIR) {
                        neighbour.state.update(state, pos, neighbour.direction.opposite)
                    }
                });

                for(let i = 0; i < 6; i++){
                    this.mesh.setMatrixAt(index + i, Chunk.EMPTY_MATRIX);
                }
            } else {
                let state = new Blocks.BlockState(block, pos, this.level, this, this.mesh, index);
                this.blocks.set(serial, state);
                let neighbours = this.level.getNeighbour(pos);
                state.onPlace(neighbours);

                neighbours.forEach(neighbour => {
                    if (neighbour.state.block != Blocks.AIR) {
                        neighbour.state.update(state, pos, neighbour.direction.opposite)
                    }
                })
            }
        }

        public getBlock(pos: BlockPos): BlockState {
            let block = this.blocks.get(pos.serialize());
            if (!block) {
                return new Blocks.BlockState(Blocks.AIR, pos, this.level, this,null,-1);
            }

            return block;
        }

        public tick() {
            this.blocks.forEach((state, pos) => {
                state.tick();
            });
        }

        public generate() {
            console.log("Generating chunk " + this.chunkPos.x + " " + this.chunkPos.z + " - " + this.chunkPos.serialize());


            let size = Chunk.CHUNK_SIZE;
            for (let x = this.chunkPos.x * size; x < this.chunkPos.x * size + size; x++) {
                for (let z = this.chunkPos.z * size; z < this.chunkPos.z * size + size; z++) {
                    let n = Math.max(1,
                        (this.level.noise.noise2D(x / this.level.noiseFreq, z / this.level.noiseFreq) + 1) * 15
                    )
                    let ny = Math.round(n);
                    for (let y = 0; y < ny; y++) {
                        let pos = BlockPos.create(x, y, z);
                        let block = Blocks.DIRT;
                        if (y == ny - 1) {
                            block = Blocks.GRASS_BLOCK;
                        }
                        this.setBlock(pos, block);
                    }
                }
            }
        }

        public load() {
            if (this.loaded) {
                return
            }
            console.log("Loading chunk " + this.chunkPos.serialize())
            //this.blocks.forEach((block) => block.load(this.level.scene));
            this.level.scene.add(this.mesh);
            this.loaded = true;
            this.level.loadedChunks.set(this.chunkPos.serialize(), this);
        }

        public unload() {
            if (!this.loaded) {
                return
            }
            console.log("Unloading chunk " + this.chunkPos.serialize())
            //this.blocks.forEach((block) => block.unload(this.level.scene));
            this.mesh.removeFromParent();
            this.loaded = false;
            this.level.loadedChunks.delete(this.chunkPos.serialize());
        }
    }

    export class Level {
        private readonly chunks: Map<string, Chunk> = new Map<string, Chunk>();
        public readonly loadedChunks: Map<string, Chunk> = new Map<string, Chunk>();
        public readonly scene: THREE.Scene;

        public readonly seaLevel: 10;
        public readonly noise = new SimplexNoise();
        public readonly noiseFreq = 50;

        public gravity: number = 0.008;

        constructor(scene: THREE.Scene) {
            this.scene = scene;
        }

        public createChunk(pos: ChunkPos): Chunk {
            let chunk = new Chunk(this, pos);
            this.chunks.set(pos.serialize(), chunk);
            return chunk;
        }

        public setBlock(pos: BlockPos, block: Block): void {
            let chunkPos = ChunkPos.fromBlockPos(pos);
            let long = chunkPos.serialize();

            let chunk: Chunk = null;
            if (this.chunks.has(long)) {
                chunk = this.chunks.get(long);
            } else {
                chunk = this.createChunk(chunkPos);
            }

            chunk.setBlock(pos, block);
        }

        public getBlock(pos: BlockPos): BlockState {
            let chunkPos = ChunkPos.fromBlockPos(pos);
            let long = chunkPos.serialize();
            if (this.chunks.has(long)) {
                return this.chunks.get(long).getBlock(pos);
            }

            return new Blocks.BlockState(Blocks.AIR, pos, this, null,null,-1);
        }

        public forEachBlockNear(pos: BlockPos, xzRange: number, yRange: number, callback: (state: BlockState, pos: BlockPos) => boolean) {
            let blockPos: BlockPos[] = [];
            for (let x = pos.x - (xzRange / 2); x <= pos.x + (xzRange / 2); x++) {
                for (let z = pos.z - (xzRange / 2); z <= pos.z + (xzRange / 2); z++) {
                    for (let y = pos.y - (yRange / 2); y <= pos.y + (yRange / 2); y++) {
                        blockPos.push(new BlockPos(x, y, z));
                    }
                }
            }

            let doNext = true;
            blockPos.forEach((blockPos) => {
                if (doNext) {
                    doNext = callback(this.getBlock(blockPos), blockPos);
                }
            })
        }

        public getNeighbour(pos: BlockPos): { direction: Direction, state: BlockState }[] {
            let neighbours = [];

            Direction.values.forEach(dir => {
                let block = pos.offset(dir, 1);
                neighbours.push({direction: dir, state: this.getBlock(block)});
            })

            return neighbours;
        }

        public tick() {
            this.chunks.forEach((chunk, long) => {
                chunk.tick();
            })
        }

        public manageChunks(pos: BlockPos, range: number) {
            let loadedPos: ChunkPos[] = [];

            let chunkPos = ChunkPos.fromBlockPos(pos);
            loadedPos.push(chunkPos);

            for (let i = -range; i <= range; i++) {
                for (let j = -range; j <= range; j++) {
                    let nextChunkPos = chunkPos.relative(i, j);
                    loadedPos.push(nextChunkPos);
                }
            }

            this.generateInRange(loadedPos, pos, range);

            this.loadedChunks.forEach((chunk, serial) => {
                let includes = false;
                for (let pos of loadedPos) {
                    if (pos.equals(chunk.chunkPos)) {
                        includes = true;
                        break;
                    }
                }
                if (!includes) {
                    chunk.unload();
                }
            })

            loadedPos.forEach(pos => {
                this.chunks.get(pos.serialize()).load();
            })
        }

        public generateInRange(loadedPos: ChunkPos[], pos: BlockPos, range: number) {
            loadedPos.forEach((pos) => {
                let long = pos.serialize();
                if (!this.chunks.has(long)) {
                    let chunk = this.createChunk(pos);
                    chunk.generate();
                }
            });
        }
    }
}