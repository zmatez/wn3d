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

        public get(direction: Direction): THREE.Material{
            for (let material of this.materials) {
                if(material.direction == direction){
                    return material.material;
                }
            }
            return null;
        }

        public toArray(): THREE.Material[]{
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

        private static load(path: string, filter: THREE.TextureFilter): THREE.Texture {
            let texture = MaterialHelper.loader.load(path);
            texture.minFilter = filter;
            texture.magFilter = filter;
            return texture;
        }

        public static newMat(path: string): THREE.Material {
            let map = MaterialHelper.load(path,THREE.NearestFilter);
            return new THREE.MeshLambertMaterial({
                map: map,
                side: THREE.BackSide
            });
        }
    }

    export class ShaderHelper {
        public static load(path: string): string{
            let glsl = Utilities.Utils.getSync("shaders/" + path + ".glsl");
            if(glsl == null){
                throw new Error("Unable to load shader: " + path);
            }

            return glsl;
        }
    }
}