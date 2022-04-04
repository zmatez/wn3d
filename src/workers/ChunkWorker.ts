import {Vec} from "../math/Vec";
import {ChunkGeneration} from "./ChunkGeneration";
import BlockChunk = ChunkGeneration.BlockChunk;

class ChunkWorker {
    public static instance: ChunkWorker;

    public events: Map<string, (data: any) => void> = new Map<string, (data: any) => void>();
    public simulationDistance: number = null;
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

        this.receive("distances", (data) => {
            this.simulationDistance = data['simulation_distance'];
            this.renderDistance = data['render_distance'];
        });
        this.receive("update", (data) => {
            let pos = new Vec.ChunkPos(data['pos']['x'], data['pos']['z']);
            let loadedChunks = [];
            for (let chunkPos of data['loaded_chunks']) {
                loadedChunks.push(new Vec.ChunkPos(chunkPos['x'], chunkPos['z']));
            }

            this.loader.update(pos, loadedChunks);
        });
        this.receive("start_render", () => {
            this.loader.onlyGen = false;
            this.loader.toLoad = [];
        })

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
    public toLoad: {pos: Vec.ChunkPos, render: boolean}[] = [];
    public queueTime: number;
    public executor: TimerHandler;
    public generatedChunks: Vec.ChunkPos[] = [];

    public onlyGen: boolean = true;
    public sendStatusChunks: boolean = false;

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
                if (generatedChunk.x == next.pos.x && generatedChunk.z == next.pos.z) {
                    generated = true;
                    break;
                }
            }

            if (!generated) {
                this.generatedChunks.push(next.pos);

                let blockChunk = new BlockChunk(next.pos);
                blockChunk.generate();

                this.worker.post("generate", {
                    x: next.pos.x,
                    z: next.pos.z,
                    chunk: blockChunk.serialize()
                });
            }

            if(next.render) {
                this.worker.post("load", {
                    x: next.pos.x,
                    z: next.pos.z
                });
            }
        }
    }

    update(chunkPos: Vec.ChunkPos, loadedChunks: Vec.ChunkPos[]) {
        this.toLoad = [];
        this.position = chunkPos;

        let inRangePos: {pos: Vec.ChunkPos, render: boolean}[] = [];

        //inRangePos.push({pos: chunkPos, render: !this.onlyGen});

        for (let i = 0; i <= this.worker.simulationDistance; i++) { //start at center and move out layer by layer
            for (let x = -i; x <= i; x++) { //get all chunks inside current layer
                for (let z = -i; z <= i; z++) {
                    let toRender = i <= this.worker.renderDistance;
                    if(this.onlyGen){
                        toRender = false;
                    }
                    let nextPos = chunkPos.relative(x, z);
                    inRangePos.push({pos: nextPos, render: toRender});
                }
            }
        }

        loadedChunks.forEach(chunkPos => {
            let includes = false;
            for (let pos of inRangePos) {
                if (pos.pos.equals(chunkPos)) {
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
                if (pos.pos.equals(chunkPos)) {
                    includes = true;
                    break;
                }
            }
            // chunk is not loaded but is in range
            if (!includes) {
                this.load(pos.pos,pos.render);
            }
        })

        if(!this.sendStatusChunks){
            this.sendStatusChunks = true;
            this.worker.post("to_simulate",this.toLoad.length);
        }
    }

    private load(pos: Vec.ChunkPos, render: boolean) {
        let qIndex = this.isInQueue(pos);
        if (qIndex == -1) {
            this.toLoad.push({
                pos: pos,
                render: render
            });
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
            if (chunkPos.pos.x == pos.x && chunkPos.pos.z == pos.z) {
                return i;
            }
        }
        return -1;
    }
}

let worker = new ChunkWorker();
worker.start();