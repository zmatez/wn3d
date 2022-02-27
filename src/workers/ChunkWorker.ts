import {Vec} from "../math/Vec";
import {ChunkGeneration} from "./ChunkGeneration";
import BlockChunk = ChunkGeneration.BlockChunk;

class ChunkWorker {
    public static instance: ChunkWorker;

    public events: Map<string, (data: any) => void> = new Map<string, (data: any) => void>();
    public renderDistance: number = null;
    public loader: ChunkLoader;

    constructor() {
        ChunkWorker.instance = this;
    }

    start() {
        this.loader = new ChunkLoader(this, 150);

        addEventListener('message', (e) => {
            let type = e.data['type'];
            let data = e.data['data'];

            if (this.events.has(type)) {
                this.events.get(type)(data);
            }
        })
        //-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=

        this.receive("render_distance", (data) => {
            if (typeof data == "number") {
                this.renderDistance = data;
            }
        });
        this.receive("update", (data) => {
            let pos = new Vec.ChunkPos(data['pos']['x'], data['pos']['z']);
            let loadedChunks = [];
            for (let chunkPos of data['loaded_chunks']) {
                loadedChunks.push(new Vec.ChunkPos(chunkPos['x'], chunkPos['z']));
            }

            this.loader.update(pos, loadedChunks);
        });

        //-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
        this.post("ready", null);
    }

    post(channel: string, data: any) {
        postMessage({
            type: channel,
            data: data
        });
    }

    receive(channel: string, callback: (data: any) => void) {
        this.events.set(channel, callback);
    }
}

class ChunkLoader {
    public worker: ChunkWorker;
    public position: Vec.ChunkPos;
    public toLoad: Vec.ChunkPos[] = [];
    public queueTime: number;
    public executor: TimerHandler;
    public generatedChunks: Vec.ChunkPos[] = [];

    constructor(worker: ChunkWorker, queueTime: number) {
        this.worker = worker;
        this.queueTime = queueTime;
        this.executor = () => {
            this.execQueue();
        };

        setInterval(this.executor, queueTime);
    }

    execQueue() {
        let next = this.toLoad[0];
        if (next) {
            this.toLoad.splice(0, 1);
            let generated = false;
            for (let generatedChunk of this.generatedChunks) {
                if (generatedChunk.x == next.x && generatedChunk.z == next.z) {
                    generated = true;
                    break;
                }
            }

            if (!generated) {
                this.generatedChunks.push(next);

                let blockChunk = new BlockChunk(next);
                blockChunk.generate();

                this.worker.post("generate", {
                    x: next.x,
                    z: next.z,
                    chunk: blockChunk.serialize()
                });
            }

            this.worker.post("load", {
                x: next.x,
                z: next.z
            });
        }
    }

    update(chunkPos: Vec.ChunkPos, loadedChunks: Vec.ChunkPos[]) {
        this.toLoad = [];
        this.position = chunkPos;

        let inRangePos: Vec.ChunkPos[] = [];

        inRangePos.push(chunkPos);

        for (let i = 0; i <= this.worker.renderDistance; i++) { //start at center and move out layer by layer
            for (let x = -i; x <= i; x++) { //get all chunks inside current layer
                for (let z = -i; z <= i; z++) {
                    let nextPos = chunkPos.relative(x, z);
                    inRangePos.push(nextPos);
                }
            }
        }

        loadedChunks.forEach(chunkPos => {
            let includes = false;
            for (let pos of inRangePos) {
                if (pos.equals(chunkPos)) {
                    includes = true;
                    break;
                }
            }
            // chunk does not need to be loaded anymore, out of range
            if (!includes) {
                this.unload(chunkPos);
            }
        })

        inRangePos.forEach(pos => {
            let includes = false;
            for (let chunkPos of loadedChunks) {
                if (pos.equals(chunkPos)) {
                    includes = true;
                    break;
                }
            }
            // chunk is not loaded but is in range
            if (!includes) {
                this.load(pos);
            }
        })
    }

    private load(pos: Vec.ChunkPos) {
        let qIndex = this.isInQueue(pos);
        if (qIndex == -1) {
            this.toLoad.push(pos);
        }
    }

    private unload(pos: Vec.ChunkPos) {
        let qIndex = this.isInQueue(pos);
        if (qIndex != -1) {
            this.toLoad.splice(qIndex, 1);
        }

        this.worker.post("unload", {
            x: pos.x,
            z: pos.z
        })
    }

    private isInQueue(pos: Vec.ChunkPos): number {
        for (let i = 0; i < this.toLoad.length; i++) {
            let chunkPos = this.toLoad[i];
            if (chunkPos.x == pos.x && chunkPos.z == pos.z) {
                return i;
            }
        }
        return -1;
    }
}

let worker = new ChunkWorker();
worker.start();