import * as THREE from "three";
import Stats from "stats-js";

import {Levels} from "../world/Levels";
import Level = Levels.Level;
import {Vec} from "../math/Vec";
import BlockPos = Vec.BlockPos;
import {Blocks} from "../block/Blocks";
import {Controls} from "./Controls";
import Player = Controls.Player;
import {UI} from "./UI";
import GUI = UI.GUI;
import Chunk = Levels.Chunk;
import {Environment} from "../render/Environment";
import Skybox = Environment.SkyBox;

export class App {
    public scene: THREE.Scene;
    public camera: THREE.PerspectiveCamera;
    public renderer: THREE.WebGLRenderer;
    public player: Player;
    public working: boolean = true;
    public gui: GUI;
    public readonly renderDistance: number = 2;
    public fpsStats: Stats;
    public ticksPerSecond: number = 5;
    public lastTick: Date;
    private clock = new THREE.Clock();
    private clockDelta = 0;
    private desiredFPS = 1 / 60;


    public skyBox: Skybox;
    public sunPos: number = 50;

    public level: Level;

    setup() {
        console.info("Starting WildNature 3D");


        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x93D7F1);

        const hemisphereLight = new THREE.HemisphereLight(0x93D7F1, 0xffffff, 0.7);
        hemisphereLight.position.set(0, 512, 0);
        this.scene.add(hemisphereLight);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

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

        this.gui = new GUI();

        this.skyBox = new Skybox(this.renderer,this.scene, this.renderDistance, Chunk.CHUNK_SIZE);
        this.skyBox.setSkyPos(this.sunPos);

        this.start()
    }

    private start() {
        this.gui.create();

        const createStat = (panel: number) => {
            let stats = new Stats();
            stats.dom.classList.add("stat");
            stats.showPanel(panel);
            this.gui.stats.appendChild(stats.dom);
            return stats;
        }

        this.fpsStats = createStat(0);


        Blocks.Block.setup(Chunk.CHUNK_SIZE, Chunk.CHUNK_DEPTH, this.renderDistance);

        Blocks.Block.BLOCKS.forEach(block => block.prepare(this.scene));
        this.level = new Level(this.scene);

        this.player = new Player(this.scene, this.level, this.camera, this);
        this.gameLoop();
    }

    private gameLoop() {
        if (this.working) {
            requestAnimationFrame(() => this.gameLoop());

            this.clockDelta += this.clock.getDelta();

            if (this.clockDelta  > this.desiredFPS) {
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

                this.clockDelta %= this.desiredFPS;
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
        this.level.manageChunks(this.player.onBlockPos, this.renderDistance);

        let aabb = this.player.aabb;

        this.gui.setDebugText(`
        <span>Position: <span style="color: #fc8878">x${this.player.onPos.x.toFixed(2)} y${this.player.onPos.y.toFixed(2)} z${this.player.onPos.z.toFixed(2)}</span></span>
        <span>AABB: <span style="color: #fc8878">x${aabb.min.x.toFixed(2)} y${aabb.min.y.toFixed(2)} z${aabb.min.z.toFixed(2)} => x${aabb.max.x.toFixed(2)} y${aabb.max.y.toFixed(2)} z${aabb.max.z.toFixed(2)}</span></span>
        <span>Block below: <span style="color: #8ff57a">${this.level.getBlock(this.player.onBlockPos).block.registryName}</span></span>
        <span>Below pos: <span style="color: #8ff57a">x${this.player.onBlockPos.x} y${this.player.onBlockPos.y} z${this.player.onBlockPos.z}</span></span>
        <span>Rotation: <span style="color: #8ff57a">x${this.player.rotation.x} y${this.player.rotation.y}</span></span>
        <span>Direction: <span style="color: #8ff57a">${this.player.lookDir.name}</span></span>
        <span>Look pos: <span style="color: #8ff57a">${this.player.look == null ? "?" : ("x" + this.player.look.block.pos.x + " y" + this.player.look.block.pos.y + " z" + this.player.look.block.pos.z)}</span></span>
        <span>On Ground: <span style="color: #769dff">${this.player.onGround}</span></span>
        <span>Flying: <span style="color: #769dff">${this.player.flying}</span></span>
        <span>yForce: <span style="color: #dd76ff">${this.player.yForce}</span></span>
        <span>Mesh data: <span style="color: #ffe845">${this.player.look == null ? "?" : (this.player.look.block.block == Blocks.AIR ? "AIR" : this.player.look.block.stringFaces())}</span></span>
        <span>Light Intensity: <span style="color: #ffae45">${this.skyBox.light.intensity}</span></span>
        <span>Sun Deg: <span style="color: #ffae45">${this.skyBox.config.elevation}</span></span>
        `);

        this.player.tick();
    }

    private render() {
        this.renderer.render(this.scene, this.camera);
        //this.player.render(this.scene);
    }
}

let app = new App();
app.setup();