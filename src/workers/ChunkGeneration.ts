import {Blocks} from "../block/Blocks";
import SimplexNoise from "simplex-noise";
import {Vec} from "../math/Vec";
import {Levels} from "../world/Levels";
import {Directions} from "../math/Directions";
import {MathUtilities} from "../math/MathUtilities";


const noise = new SimplexNoise();
const minNoiseFreq = 50;
const maxNoiseFreq = 150;
const mountainNoise = new SimplexNoise();
const mountainFreq = 400;
const terrainNoise = new SimplexNoise();
const terrainFreq = 200;

export namespace ChunkGeneration {
    import BlockState = Blocks.BlockState;
    import Block = Blocks.Block;
    import Direction = Directions.Direction;

    export class BlockChunk {
        public readonly chunkPos: Vec.ChunkPos;
        public readonly blocks: BlockState[][][] = [];

        constructor(pos: Vec.ChunkPos) {
            this.chunkPos = pos;
        }

        private makeArray(x: number, y: number, z: number) {
            if(!this.blocks[x]){
                this.blocks[x] = [];
            }

            if(!this.blocks[x][y]){
                this.blocks[x][y] = [];
            }
        }

        public static deserialize(data: { chunk_pos: { x: number, z: number }, blocks: [][][] }, level: Levels.Level, callback: (chunk: Levels.Chunk) => void): void {
            let chunk = level.createChunk(new Vec.ChunkPos(data.chunk_pos.x, data.chunk_pos.z));
            let blocks: BlockState[][][] = [];

            data.blocks.forEach((blocksYZ, x) => {
                blocksYZ.forEach((blocksZ, y) => {
                    blocksZ.forEach((block, z) => {
                        let state = BlockState.deserialize(block);
                        state.setupLevel(level, chunk, chunk.renderer);
                        let planes = 0;
                        state.faces.forEach(value => {
                            if (value) {
                                planes++;
                            }
                        });
                        chunk.renderer.planes += planes;
                        state.updateMesh();

                        if(!blocks[x]){
                            blocks[x] = [];
                        }

                        if(!blocks[x][y]){
                            blocks[x][y] = [];
                        }

                        blocks[x][y][z] = state;
                    })
                })
            })

            chunk.blocks = blocks;
            callback(chunk);
        }

        public setBlock(pos: Vec.BlockPos, block: Block): void {
            let cp = this.chunkPos.relativeBlockPos(pos);
            this.makeArray(cp.x,cp.y,cp.z);

            if (block == Blocks.AIR) {
                let state = new Blocks.BlockState(Blocks.AIR, pos);
                this.blocks[cp.x][cp.y][cp.z] = null;
                this.getNeighbour(pos).forEach(neighbour => {
                    if (neighbour.state.block != Blocks.AIR) {
                        neighbour.state.update(state, pos, neighbour.direction.opposite);
                    }
                });
            } else {
                let state = new Blocks.BlockState(block, pos);
                let neighbour = this.getNeighbour(pos);
                this.blocks[cp.x][cp.y][cp.z] = state;
                state.onPlace(neighbour);

                neighbour.forEach(neighbour => {
                    if (neighbour.state.block != Blocks.AIR) {
                        neighbour.state.update(state, pos, neighbour.direction.opposite);
                    }
                })
            }
        }

        public getBlock(pos: Vec.BlockPos): BlockState {
            let cp = this.chunkPos.relativeBlockPos(pos);
            this.makeArray(cp.x,cp.y,cp.z);
            let block = this.blocks[cp.x][cp.y][cp.z];
            if (!block) {
                return new Blocks.BlockState(Blocks.AIR, pos);
            }

            return block;
        }

        public getNeighbour(pos: Vec.BlockPos): { direction: Direction, state: BlockState }[] {
            let neighbours = [];

            Direction.values.forEach(dir => {
                let block = pos.offset(dir, 1);
                let chunkPos = Vec.ChunkPos.fromBlockPos(block);
                if (this.chunkPos.x == chunkPos.x && this.chunkPos.z == chunkPos.z) {
                    neighbours.push({direction: dir, state: this.getBlock(block)});
                } else {
                    neighbours.push({direction: dir, state: new Blocks.BlockState(Blocks.AIR, pos)});
                }
            })

            return neighbours;
        }

        public generate() {
            let size = Levels.Chunk.CHUNK_SIZE;
            for (let x = this.chunkPos.x * size; x < this.chunkPos.x * size + size; x++) {
                for (let z = this.chunkPos.z * size; z < this.chunkPos.z * size + size; z++) {
                    let mountain = MathUtilities.Utils.scaleBetween(mountainNoise.noise2D(x/mountainFreq,z/mountainFreq),minNoiseFreq,maxNoiseFreq,-1,1);
                    let terrain = MathUtilities.Utils.scaleBetween(terrainNoise.noise2D(x/terrainFreq,z/terrainFreq),Levels.Chunk.CHUNK_DEPTH * 0.1,Levels.Chunk.CHUNK_DEPTH * 0.7,-1,1);

                    let n = Math.max(1,
                        (noise.noise2D(x / mountain, z / mountain) + 1) * (terrain)
                    )

                    let ny = Math.min(Math.round(n), Levels.Chunk.CHUNK_DEPTH);
                    for (let y = 0; y < ny; y++) {
                        let pos = Vec.BlockPos.create(x, y, z);
                        let block = Blocks.DIRT;
                        if (y == ny - 1) {
                            block = Blocks.GRASS_BLOCK;
                        }
                        this.setBlock(pos, block);
                    }
                }
            }
        }

        public serialize(): any {
            let blocks = [];
            this.blocks.forEach((blocksYZ, x) => {
                blocksYZ.forEach((blocksZ, y) => {
                    blocksZ.forEach((block, z) => {
                        if (block) {
                            if(!blocks[x]){
                                blocks[x] = [];
                            }

                            if(!blocks[x][y]){
                                blocks[x][y] = [];
                            }

                            blocks[x][y][z] = block.serialize();
                        }
                    })
                })
            })

            return {
                chunk_pos: {
                    x: this.chunkPos.x,
                    z: this.chunkPos.z
                },
                blocks: blocks
            }
        }
    }

}