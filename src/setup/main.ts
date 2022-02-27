import * as THREE from "three";
import Stats from "stats-js";

import {Levels} from "../world/Levels";
import {Controls} from "./Controls";
import {UI} from "./UI";
import {Environment} from "../render/Environment";
import {Textures} from "../block/Textures";
import Player = Controls.Player;
import GUI = UI.GUI;
import Skybox = Environment.SkyBox;
import {Vec} from "../math/Vec";
import ChunkPos = Vec.ChunkPos;

export class App {
    public static instance: App;

    public scene: THREE.Scene;
    public camera: THREE.PerspectiveCamera;
    public renderer: THREE.WebGLRenderer;
    public player: Player;
    public working: boolean = true;
    public gui: GUI;
    public readonly renderDistance: number = 8;
    public fpsStats: Stats;
    public ticksPerSecond: number = 5;
    public lastTick: Date;
    public skyBox: Skybox;
    public sunPos: number = 50;
    public level: Levels.Level;
    //private clock = new THREE.Clock();
    //private clockDelta = 0;
    //private desiredFPS = 1 / 144;

    constructor() {
        App.instance = this;
    }

    load() {
        console.info("Loading WildNature 3D");

        this.gui = new GUI();
        this.gui.create();
        this.setLoadingProgress(0);

        setTimeout(() => {
            Textures.load((prg) => {
                this.setLoadingProgress(prg);
            });
        }, 100);
    }

    setLoadingProgress(percentage) {
        this.gui.setLoadingProgress(percentage, () => this.setup());
    }

    setup() {
        console.info("Starting WildNature 3D");

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x93D7F1);

        const hemisphereLight = new THREE.HemisphereLight(0x93D7F1, 0xffffff, 0.7);
        hemisphereLight.position.set(0, 512, 0);
        this.scene.add(hemisphereLight);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);

        let pixelRatio = window.devicePixelRatio
        let AA = true
        if (pixelRatio > 1) {
            AA = false
        }

        this.renderer = new THREE.WebGLRenderer({
            antialias: AA,
            powerPreference: "high-performance",
            logarithmicDepthBuffer: false,
            alpha: true,
            preserveDrawingBuffer: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.5;
        this.renderer.autoClear = false;
        this.renderer.info.autoReset = false;

        document.body.appendChild(this.renderer.domElement);

        window.addEventListener("resize", () => {
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
        });


        this.start()
    }

    private start() {
        const createStat = (panel: number) => {
            let stats = new Stats();
            stats.dom.classList.add("stat");
            stats.showPanel(panel);
            this.gui.stats.appendChild(stats.dom);
            return stats;
        }

        this.fpsStats = createStat(0);


        //Blocks.Block.setup(Chunk.CHUNK_SIZE, Chunk.CHUNK_DEPTH, this.renderDistance);

        //Blocks.Block.BLOCKS.forEach(block => block.prepare(this.scene));

        this.level = new Levels.Level(this.scene, this.renderDistance);

        this.skyBox = new Skybox(this.renderer, this.scene, this.level, this.renderDistance, Levels.Chunk.CHUNK_SIZE);
        this.skyBox.setSkyPos(this.sunPos);

        this.player = new Player(this.scene, this.level, this.camera, this);
        this.gameLoop();
    }

    private gameLoop() {
        if (this.working) {
            requestAnimationFrame(() => this.gameLoop());

            // this.clockDelta += this.clock.getDelta();
            //
            // if (this.clockDelta > this.desiredFPS) {
            //
            //
            //     this.clockDelta %= this.desiredFPS;
            // }

            try {
                this.fpsStats.begin();
                this.update();
                this.render();
                this.fpsStats.end();
            } catch (e) {
                console.error("Error occurred, application stopped working.")
                this.working = false;
                throw e;
            }
        }
    }

    private update() {
        // @ts-ignore
        if (this.lastTick == null || (new Date() - this.lastTick) >= (1000 / this.ticksPerSecond)) {
            this.tick();
            this.lastTick = new Date();
        }
        this.player.update();
        this.skyBox.updatePos(this.player.onPos);
    }

    private tick() {
        this.level.manageChunks(this.player.onBlockPos);

        let aabb = this.player.aabb;

        try {
            let posBelow = this.level.getBlock(this.player.onBlockPos);
            let chunkPos = ChunkPos.fromBlockPos(this.player.onBlockPos);

            this.gui.setDebugText(`
                <span>Position: <span style="color: #fc8878">x${this.player.onPos.x.toFixed(2)} y${this.player.onPos.y.toFixed(2)} z${this.player.onPos.z.toFixed(2)}</span></span>
                <span>AABB: <span style="color: #fc8878">x${aabb.min.x.toFixed(2)} y${aabb.min.y.toFixed(2)} z${aabb.min.z.toFixed(2)} => x${aabb.max.x.toFixed(2)} y${aabb.max.y.toFixed(2)} z${aabb.max.z.toFixed(2)}</span></span>
                <span>Block below: <span style="color: #8ff57a">${posBelow.block.registryName}</span></span>
                <span>Relative pos: <span style="color: #8ff57a">x${posBelow.relativePos.x} y${posBelow.relativePos.y} z${posBelow.relativePos.z} </span></span>
                <span>Below pos: <span style="color: #8ff57a">x${this.player.onBlockPos.x} y${this.player.onBlockPos.y} z${this.player.onBlockPos.z}</span></span>
                <span>Chunk pos: <span style="color: #8ff57a">x${chunkPos.x} z${chunkPos.z}</span></span>
                <span>Rotation: <span style="color: #8ff57a">x${this.player.rotation.x} y${this.player.rotation.y}</span></span>
                <span>Direction: <span style="color: #8ff57a">${this.player.lookDir.name}</span></span>
                <span>Look pos: <span style="color: #8ff57a">${this.player.look == null ? "?" : ("x" + this.player.look.block.pos.x + " y" + this.player.look.block.pos.y + " z" + this.player.look.block.pos.z)}</span></span>
                <span>On Ground: <span style="color: #769dff">${this.player.onGround}</span></span>
                <span>Flying: <span style="color: #769dff">${this.player.flying}</span></span>
                <span>yForce: <span style="color: #dd76ff">${this.player.yForce}</span></span>
                <span>Light Intensity: <span style="color: #ffae45">${this.skyBox.light.intensity}</span></span>
                <span>Sun Deg: <span style="color: #ffae45">${this.skyBox.config.elevation}</span></span>
                <span>Render frame: <span style="color: #99ff00">${this.renderer.info.render.frame}</span></span>
                <span>Render lines: <span style="color: #99ff00">${this.renderer.info.render.lines}</span></span>
                <span>Render calls: <span style="color: #99ff00">${this.renderer.info.render.calls}</span></span>
                <span>Render points: <span style="color: #99ff00">${this.renderer.info.render.points}</span></span>
                <span>Render triangle: <span style="color: #99ff00">${this.renderer.info.render.triangles}</span></span>
                <span>Textures: <span style="color: #99ff00">${this.renderer.info.memory.textures}</span></span>
                <span>Geometries: <span style="color: #99ff00">${this.renderer.info.memory.geometries}</span></span>
        `);
        } catch (e) {
            this.gui.debugError();
        }

        this.player.tick();
    }

    private render() {
        this.renderer.render(this.scene, this.camera);
        //this.player.render(this.scene);
    }
}