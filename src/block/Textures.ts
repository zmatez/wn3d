import * as THREE from "three";
import {Directions} from "../math/Directions";
import {Utilities} from "../setup/Utilities";

export namespace Textures {
    import Direction = Directions.Direction;

    export class MaterialConfig {
        public materials: { direction: Direction, material: THREE.Material }[] = [];

        public with(direction: Direction, material: THREE.Material): this {
            this.materials.push({direction: direction, material: material});
            return this;
        }

        public fill(material: THREE.Material): this {
            Direction.values.forEach(dir => this.with(dir, material));
            return this;
        }

        public get(direction: Direction): THREE.Material {
            for (let material of this.materials) {
                if (material.direction == direction) {
                    return material.material;
                }
            }
            return null;
        }

        public toArray(): THREE.Material[] {
            return [
                this.get(Direction.WEST),
                this.get(Direction.EAST),
                this.get(Direction.UP),
                this.get(Direction.NORTH),
                this.get(Direction.SOUTH),
                this.get(Direction.DOWN)
            ]
        }
    }

    export class MaterialHelper {
        private static readonly loader = new THREE.TextureLoader();
        private static readonly cubeLoader = new THREE.CubeTextureLoader();

        public static makeFullCube(path: string): MaterialConfig {
            return new MaterialConfig()
                .fill(this.newMat(path));
        }

        public static makeSkybox(path: string): MaterialConfig {
            const create = (suff) => {
                let vertex = ShaderHelper.load("environment/hemisphere_vertex");
                let fragment = ShaderHelper.load("environment/hemisphere_fragment");

                let uniforms = {};
                let map = MaterialHelper.load(path + suff + ".png", THREE.LinearFilter);

                return new THREE.ShaderMaterial({
                    uniforms: uniforms,
                    side: THREE.BackSide,

                });
            }

            return new MaterialConfig()
                .with(Direction.UP, create("top"))
                .with(Direction.DOWN, create("bottom"))
                .with(Direction.NORTH, create("front"))
                .with(Direction.SOUTH, create("back"))
                .with(Direction.EAST, create("left"))
                .with(Direction.WEST, create("right"))
        }

        public static makeSkyboxTextures(): THREE.Texture {
            let textures: string[] = [
                "left",
                "right",
                "top",
                "bottom",
                "front",
                "back",
            ]

            for (let i = 0; i < textures.length; i++) {
                textures[i] = "assets/textures/skybox/" + textures[i] + ".png";
            }

            return MaterialHelper.cubeLoader.load(textures);
        }

        public static makeTopSideBottom(pathTop: string, pathSide: string, pathBottom: string): MaterialConfig {
            return new MaterialConfig()
                .with(Direction.UP, this.newMat(pathTop))
                .with(Direction.DOWN, this.newMat(pathBottom))
                .with(Direction.NORTH, this.newMat(pathSide))
                .with(Direction.SOUTH, this.newMat(pathSide))
                .with(Direction.EAST, this.newMat(pathSide))
                .with(Direction.WEST, this.newMat(pathSide))
        }

        public static newMat(path: string): THREE.Material {
            let map = MaterialHelper.load(path, THREE.NearestFilter);
            return new THREE.MeshLambertMaterial({
                map: map,
                side: THREE.BackSide
            });
        }

        private static load(path: string, filter: THREE.TextureFilter): THREE.Texture {
            let texture = MaterialHelper.loader.load(path);
            texture.minFilter = filter;
            texture.magFilter = filter;
            return texture;
        }
    }

    export class Texture {
        public static textures: Texture[] = [];
        public path;
        public id;

        /**
         * @param path starts with 'assets/'
         */
        constructor(path) {
            this.path = path;
        }

        public static register(texture: Texture): Texture {
            this.textures.push(texture);
            return texture;
        }

        getImage(): HTMLImageElement {
            let img = document.createElement('img');
            img.src = "assets/" + this.path;

            return img;
        }
    }

    export class BlockTexture extends Texture {
        constructor(blockPath) {
            super("textures/blocks/" + blockPath + ".png");
        }
    }

    export const T_GRASS_BLOCK_TOP = Texture.register(new BlockTexture("grass_block_top"));
    export const T_GRASS_BLOCK_SIDE = Texture.register(new BlockTexture("grass_block_side"));
    export const T_DIRT = Texture.register(new BlockTexture("dirt"));
    export const T_STONE = Texture.register(new BlockTexture("stone"));

    export class TextureAtlas {
        public img: HTMLImageElement;
        public loaded = false;
        private textures: Texture[];
        private entries: Map<Texture, TextureEntry> = new Map<Textures.Texture, Textures.TextureEntry>();

        constructor(textures: Texture[]) {
            this.textures = textures;
        }

        load(callback: (progress: number, total: number) => void) {
            let progress = 0;
            let total = this.textures.length;
            const update = () => {
                progress++;
                if (progress == total) {
                    this.stitch();
                }

                callback(progress, total);
            }
            let lastX = 0;
            this.textures.forEach((texture) => {
                let img = texture.getImage();
                img.onload = () => {
                    let entry = new TextureEntry(texture, lastX, 0);
                    entry.img = img;
                    lastX += entry.width;
                    this.entries.set(texture, entry);
                    update()
                }
            })
        }

        getAtlas(): THREE.Texture {
            let tex = new THREE.Texture(this.img);
            tex.minFilter = THREE.NearestFilter;
            tex.magFilter = THREE.NearestFilter;
            tex.needsUpdate = true;
            console.log("Loaded atlas of " + this.img.width + "x" + this.img.height)
            return tex;
        }

        getMaterial(): THREE.Material {
            let mat = new THREE.MeshLambertMaterial({
                side: THREE.BackSide,
            })

            const texAtlas = this.getAtlas();
            let texStep = 1 / this.textures.length;

            mat.onBeforeCompile = (shader) => {
                shader.uniforms.texAtlas = {value: texAtlas};
                shader.vertexShader = `
    	            attribute float texIdx;
    	            varying float vTexIdx;
                    ${shader.vertexShader}
                `.replace(
                    `void main() {`, `
                    void main() {
      	            vTexIdx = texIdx;
                    `);
                shader.fragmentShader = `
    	            uniform sampler2D texAtlas;
    	            varying float vTexIdx;
                    ${shader.fragmentShader}
                    `.replace(
                    `#include <map_fragment>`,
                    `
                    #include <map_fragment>
      	            vec2 uv = vUv;
      	            
       	            vec2 blockUv = vec2(uv.x * ${texStep} + (${texStep} * vTexIdx),uv.y); 
                    vec4 blockColor = texture(texAtlas, blockUv);
                    diffuseColor *= blockColor;
                `);
            }
            mat.defines = {"USE_UV": ""};


            return mat;
        }

        private stitch() {
            let maxX = 0;
            let maxY = 0;

            this.entries.forEach((texture) => {
                let mx = texture.x + texture.width;
                let my = texture.y + texture.height;

                if (mx > maxX) {
                    maxX = mx;
                }

                if (my > maxY) {
                    maxY = my;
                }
            })

            const canvas = document.createElement('canvas');
            canvas.width = maxX;
            canvas.height = maxY;
            const atlas = canvas.getContext('2d');

            let id = 0;
            this.entries.forEach((texture) => {
                texture.texture.id = id;
                const context = document.createElement('canvas').getContext('2d');
                context.drawImage(texture.img, 0, 0);
                let data = context.getImageData(0, 0, texture.width, texture.height).data;

                let imageWidth = texture.width;

                for (let x = 0; x < texture.width; x++) {
                    for (let y = 0; y < texture.height; y++) {
                        let red = data[((imageWidth * y) + x) * 4];
                        let green = data[((imageWidth * y) + x) * 4 + 1];
                        let blue = data[((imageWidth * y) + x) * 4 + 2];
                        let alpha = data[((imageWidth * y) + x) * 4 + 3];

                        atlas.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
                        atlas.fillRect(texture.x + x, texture.y + y, 1, 1);
                    }
                }

                id++;
            })

            let image = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");

            this.img = document.createElement('img');
            this.img.src = image;
            this.img.width = maxX;
            this.img.height = maxY;
            this.loaded = true;
        }
    }

    export class TextureEntry {
        public texture: Texture;
        public x: number;
        public y: number;
        public img: HTMLImageElement;

        constructor(texture: Textures.Texture, x: number, y: number) {
            this.texture = texture;
            this.x = x;
            this.y = y;
        }

        get width() {
            return this.img.width;
        }

        get height() {
            return this.img.height;
        }
    }

    export let atlas: TextureAtlas;

    //export const material = MaterialHelper.makeFullCube("assets/textures/blocks/stone.png").toArray()[0];
    export let material: THREE.Material;

    export class ShaderHelper {
        public static load(path: string): string {
            let glsl = Utilities.Utils.getSync("shaders/" + path + ".glsl");
            if (glsl == null) {
                throw new Error("Unable to load shader: " + path);
            }

            return glsl;
        }
    }

    export const load = (progressCallback: (percentage: number) => void) => {
        atlas = new TextureAtlas(Texture.textures);
        atlas.load((progress, total) => {
            console.log("Processing atlas " + progress + "/" + total);

            if (progress == total) {
                material = atlas.getMaterial();
                //App.instance.gui.element.appendChild(atlas.img);
            }

            progressCallback(Math.ceil((progress / total) * 100));
        });

    }
}