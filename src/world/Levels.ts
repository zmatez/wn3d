import {Blocks} from "../block/Blocks";
import {Vec} from "../math/Vec";
import * as THREE from "three";
import {InstancedBufferAttribute, PlaneBufferGeometry} from "three";
import {Directions} from "../math/Directions";
import SimplexNoise from "simplex-noise";
import {Textures} from "../block/Textures";
import {ChunkGeneration} from "../workers/ChunkGeneration";
import {App} from "../setup/main";

export namespace Levels {
    import BlockState = Blocks.BlockState;
    import Block = Blocks.Block;
    import Direction = Directions.Direction;

    export class Chunk {
        public static readonly CHUNK_SIZE: number = 16;
        public static readonly CHUNK_DEPTH: number = 64;
        public blocks: BlockState[][][] = [];
        public readonly chunkPos: Vec.ChunkPos;
        public loaded = false;
        public renderer: ChunkRenderer;
        private readonly level: Level;

        constructor(level: Level, chunkPos: Vec.ChunkPos) {
            this.level = level;
            this.chunkPos = chunkPos;
            this.renderer = new ChunkRenderer(this, level.scene);
        }

        private makeArray(x: number, y: number, z: number) {
            if (!this.blocks[x]) {
                this.blocks[x] = [];
            }

            if (!this.blocks[x][y]) {
                this.blocks[x][y] = [];
            }
        }

        public get isGenerated() {
            return this.blocks.length > 0;
        }

        public setBlock(pos: Vec.BlockPos, block: Block): void {
            let cp = this.chunkPos.relativeBlockPos(pos);
            this.makeArray(cp.x, cp.y, cp.z);

            const oldBlock: BlockState = this.blocks[cp.x][cp.y][cp.z];

            if (oldBlock) {
                oldBlock.remove(this.level.scene);
            }

            if (block == Blocks.AIR) {
                this.blocks[cp.x][cp.y][cp.z] = null;

                oldBlock.faces.forEach(face => {
                    if (face) {
                        oldBlock.chunk.renderer.planes--;
                    }
                })

                //remove old faces
                for (let i = 0; i < Direction.values.length; i++) {
                    let dir = Direction.values[i];

                    if (oldBlock.faces.get(dir)) {
                        oldBlock.chunk.renderer.removeMatrixAt(oldBlock.index + i);
                    }
                }

                if (oldBlock.chunk != this) {
                    oldBlock.chunk.markDirty();
                }

                let state = new Blocks.BlockState(Blocks.AIR, pos);
                state.setupLevel(this.level, this, this.renderer);
                this.level.getNeighbour(pos).forEach(neighbour => {
                    if (neighbour.state.block != Blocks.AIR) {
                        neighbour.state.update(state, pos, neighbour.direction.opposite);
                        if (neighbour.state.chunk != this) {
                            neighbour.state.chunk.markDirty()
                        }
                    }
                });

            } else {
                let state = new Blocks.BlockState(block, pos);
                state.setupLevel(this.level, this, this.renderer);
                this.blocks[cp.x][cp.y][cp.z] = state;
                let neighbours = this.level.getNeighbour(pos);
                state.onPlace(neighbours);

                neighbours.forEach(neighbour => {
                    if (neighbour.state.block != Blocks.AIR) {
                        neighbour.state.update(state, pos, neighbour.direction.opposite);
                        if (neighbour.state.chunk != this) {
                            neighbour.state.chunk.markDirty()
                        }
                    }
                })
            }

            this.markDirty();
        }

        public getBlock(pos: Vec.BlockPos): BlockState {
            let cp = this.chunkPos.relativeBlockPos(pos);
            this.makeArray(cp.x, cp.y, cp.z);
            let block = this.blocks[cp.x][cp.y][cp.z];
            if (!block) {
                const state = new Blocks.BlockState(Blocks.AIR, pos);
                state.setupLevel(this.level, this, null);
                return state;
            }

            return block;
        }

        public tick() {
            // this.blocks.forEach((state, pos) => {
            //     state.tick();
            // });
        }

        public generate() {
            console.log("Generating chunk " + this.chunkPos.x + " " + this.chunkPos.z + " - " + this.chunkPos.serialize());


            let size = Chunk.CHUNK_SIZE;
            for (let x = this.chunkPos.x * size; x < this.chunkPos.x * size + size; x++) {
                for (let z = this.chunkPos.z * size; z < this.chunkPos.z * size + size; z++) {
                    let n = Math.max(1,
                        (this.level.noise.noise2D(x / this.level.noiseFreq, z / this.level.noiseFreq) + 1) * (Chunk.CHUNK_DEPTH / 2)
                    )
                    let ny = Math.min(Math.round(n), Chunk.CHUNK_DEPTH);
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

        public load() {
            if (this.loaded) {
                return
            }
            console.log("Loading chunk " + this.chunkPos.serialize())

            this.renderer.add();
            this.loaded = true;
            this.level.loadedChunks.set(this.chunkPos.serialize(), this);
        }

        public unload() {
            if (!this.loaded) {
                return
            }
            console.log("Unloading chunk " + this.chunkPos.serialize())

            this.renderer.remove()
            this.loaded = false;
            this.level.loadedChunks.delete(this.chunkPos.serialize());
        }

        public markDirty() {
            this.level.dirtyChunks.set(this.chunkPos.serialize(), this);
        }
    }

    export class ChunkRenderer {
        public scene: THREE.Scene;
        public mesh: THREE.InstancedMesh;
        public planes: number = 0;
        public renderedPlanes: number = 0;
        public chunk: Chunk;
        public matrices: MatrixTexture[] = [];
        public geometry: THREE.PlaneBufferGeometry = new PlaneBufferGeometry(1, 1, 1);
        public texIdx: Float32Array;

        constructor(chunk: Levels.Chunk, scene: THREE.Scene) {
            this.chunk = chunk;
            this.scene = scene;
        }

        computeMesh() {
            let geom = this.geometry.clone()
            this.mesh = new THREE.InstancedMesh(geom, Textures.material, this.planes);
            this.mesh.position.x = this.chunk.chunkPos.x * Chunk.CHUNK_SIZE;
            this.mesh.position.z = this.chunk.chunkPos.z * Chunk.CHUNK_SIZE;
            this.mesh.castShadow = true;
            this.mesh.receiveShadow = true;
            this.renderedPlanes = this.planes;

            this.texIdx = new Float32Array(this.planes).fill(0);
            geom.setAttribute("texIdx", new InstancedBufferAttribute(this.texIdx, 1))
        }

        recomputeMesh() {
            if (this.mesh) {
                this.mesh.removeFromParent();
            }

            this.computeMesh();

            for (let i = 0, index = 0; i < this.matrices.length; i++) {
                let matrix = this.matrices[i];
                if (matrix) {
                    this.mesh.setMatrixAt(index, matrix.matrix);
                    this.texIdx[index] = matrix.texture != null ? matrix.texture.id : 0;
                    index++
                }
            }

            this.scene.add(this.mesh);
        }

        add() {
            this.recomputeMesh()
            //this.updateMesh();
        }

        remove() {
            this.mesh.removeFromParent();
        }

        setMatrixAt(index: number, matrix: MatrixTexture) {
            this.matrices[index] = matrix;
            if (this.mesh) {
                this.mesh.setMatrixAt(index, matrix.matrix);
                this.texIdx[index] = matrix.texture != null ? matrix.texture.id : 0;
            }
        }

        removeMatrixAt(index: number) {
            this.matrices[index] = null;
        }

        updateMesh() {
            if (this.mesh) {
                this.mesh.instanceMatrix.needsUpdate = true;
            }
        }
    }

    export class MatrixTexture {
        public matrix: THREE.Matrix4;
        public texture: Textures.Texture;

        constructor(matrix: THREE.Matrix4, texture: Textures.Texture) {
            this.matrix = matrix;
            this.texture = texture;
        }
    }

    export class Level {
        public readonly app: App;
        public readonly loadedChunks: Map<string, Chunk> = new Map<string, Chunk>();
        public readonly dirtyChunks: Map<string, Chunk> = new Map<string, Chunk>(); //chunks to recomputeMesh()
        public generatedChunks: number = 0;
        public toSimulate: number = 0;
        public readonly scene: THREE.Scene;
        public readonly renderDistance: number;
        public readonly simulationDistance: number;
        public readonly noise = new SimplexNoise();
        public readonly noiseFreq = 50;
        public readonly worker: Worker;
        public lastSentPos: Vec.ChunkPos;
        public gravity: number = 0.008;
        private readonly chunks: Map<string, Chunk> = new Map<string, Chunk>();

        public rendering: boolean = false;
        private lastRendering: boolean = false;

        constructor(app: App, scene: THREE.Scene, simulationDistance: number, renderDistance: number) {
            this.app = app;
            this.scene = scene;
            this.simulationDistance = simulationDistance;
            this.renderDistance = renderDistance;

            this.worker = new Worker("dist/worker.js");
            this.worker.addEventListener("message", (msg) => {
                let type: string = msg.data['type'];
                let data: any = msg.data['data'];
                if (type == "ready") {
                    console.info("Chunk worker ready")
                } else if (type == "to_simulate") {
                    this.toSimulate = data;
                } else if (type == "generate") {
                    ChunkGeneration.BlockChunk.deserialize(data['chunk'], this, (chunk) => {
                        chunk.markDirty();
                        this.generatedChunks++;

                        if(!this.rendering) {
                            this.app.setWorldLoadingProgress((this.generatedChunks / this.toSimulate) * 100, () => {
                                if (this.generatedChunks == this.toSimulate) {
                                    this.worker.postMessage({
                                        type: "start_render",
                                        data: null
                                    });
                                    this.rendering = true;
                                }
                            })
                        }
                    });
                } else if (type == "load") {
                    if (typeof data['x'] == "number" && typeof data['z'] == "number") {
                        let pos = new Vec.ChunkPos(data['x'], data['z']);
                        let serial = pos.serialize();

                        if (this.chunks.has(serial)) {
                            let chunk = this.chunks.get(serial);
                            chunk.load();
                        }

                        this.recomputeDirty();
                    }
                } else if (type == "unload") {
                    if (typeof data['x'] == "number" && typeof data['z'] == "number") {
                        let pos = new Vec.ChunkPos(data['x'], data['z']);

                        let serial = pos.serialize();

                        if (this.chunks.has(serial)) {
                            let chunk = this.chunks.get(serial);
                            chunk.unload();
                        }

                        this.recomputeDirty();
                    }
                }
            });

            this.worker.postMessage({
                type: "distances",
                data: {
                    simulation_distance: this.simulationDistance,
                    render_distance: this.renderDistance
                }
            })
        }

        public createChunk(pos: Vec.ChunkPos): Chunk {
            let chunk = new Chunk(this, pos);
            this.chunks.set(pos.serialize(), chunk);
            return chunk;
        }

        public setBlock(pos: Vec.BlockPos, block: Block): void {
            let chunkPos = Vec.ChunkPos.fromBlockPos(pos);
            let long = chunkPos.serialize();

            let chunk: Chunk = null;
            if (this.chunks.has(long)) {
                chunk = this.chunks.get(long);
            } else {
                chunk = this.createChunk(chunkPos);
            }

            chunk.setBlock(pos, block);
        }

        public getBlock(pos: Vec.BlockPos): BlockState {
            let chunkPos = Vec.ChunkPos.fromBlockPos(pos);
            let long = chunkPos.serialize();
            if (this.chunks.has(long)) {
                return this.chunks.get(long).getBlock(pos);
            }

            const state = new Blocks.BlockState(Blocks.AIR, pos);
            state.setupLevel(this, null, null);
            return state;
        }

        public forEachBlockNear(pos: Vec.BlockPos, xzRange: number, yRange: number, callback: (state: BlockState, pos: Vec.BlockPos) => boolean) {
            let blockPos: Vec.BlockPos[] = [];
            for (let x = pos.x - (xzRange / 2); x <= pos.x + (xzRange / 2); x++) {
                for (let z = pos.z - (xzRange / 2); z <= pos.z + (xzRange / 2); z++) {
                    for (let y = pos.y - (yRange / 2); y <= pos.y + (yRange / 2); y++) {
                        blockPos.push(new Vec.BlockPos(x, y, z));
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

        public getNeighbour(pos: Vec.BlockPos): { direction: Direction, state: BlockState }[] {
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

        public manageChunks(pos: Vec.BlockPos) {
            let chunkPos = Vec.ChunkPos.fromBlockPos(pos);
            if (!this.lastSentPos || !this.lastSentPos.equals(chunkPos) || this.lastRendering != this.rendering) {
                this.lastSentPos = chunkPos;
                this.lastRendering = this.rendering;

                this.updateWorker();
            }
        }

        private updateWorker() {
            let loadedChunks = [];
            this.loadedChunks.forEach(chunk => {
                loadedChunks.push({
                    x: chunk.chunkPos.x,
                    z: chunk.chunkPos.z
                });
            })

            this.worker.postMessage({
                type: "update",
                data: {
                    pos: {
                        x: this.lastSentPos.x,
                        z: this.lastSentPos.z
                    },
                    loaded_chunks: loadedChunks
                }
            })
        }

        public reloadChunks() {
            this.loadedChunks.forEach(chunk => {
                chunk.unload();
                chunk.renderer.recomputeMesh();
                chunk.load()
            })
        }

        public recomputeDirty() {
            if (this.dirtyChunks.size > 0) {
                this.dirtyChunks.forEach((chunk, key) => {
                    if (this.loadedChunks.has(key)) {
                        chunk.renderer.recomputeMesh();
                    }
                })
                this.dirtyChunks.clear()
            }
        }
    }
}