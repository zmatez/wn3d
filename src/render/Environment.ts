import {
    BackSide,
    BoxBufferGeometry,
    BoxGeometry, DirectionalLight, DirectionalLightHelper, MathUtils,
    Mesh,
    MeshBasicMaterial,
    Scene,
    ShaderMaterial, SpotLight, SpotLightHelper,
    UniformsUtils, Vector3, WebGLRenderer
} from "three";
import {Vec} from "../math/Vec";
import {Textures} from "../block/Textures";
import {Sky} from "three/examples/jsm/objects/Sky";
import {MathUtilities} from "../math/MathUtilities";
import {Levels} from "../world/Levels";

export namespace Environment {
    import Vec3 = Vec.Vec3;
    import MaterialHelper = Textures.MaterialHelper;
    import ShaderHelper = Textures.ShaderHelper;
    import Level = Levels.Level;

    export class SkyBox {
        private uniforms = {
            turbidity: { value: 2 },
            rayleigh: { value: 1 },
            mieCoefficient: { value: 0.005 },
            mieDirectionalG: { value: 0.8 },
            sunPosition: {
                value: new Vector3()
            },
            up: {
                value: new Vector3(0, 1, 0)
            }
        }

        config = {
            turbidity: 10,
            rayleigh: 3,
            mieCoefficient: 0.005,
            mieDirectionalG: 0.7,
            elevation: 90,
            azimuth: 120,
            exposure: 0
        }

        private readonly mesh: Mesh;
        private readonly level: Level;
        private sun: Vector3 = new Vector3(0,1,0);
        private readonly renderer: WebGLRenderer;
        private scalar: number = 4500;
        private radius: number;
        light: DirectionalLight;
        private lightEnabled: boolean = true;
        private scene: Scene;
        private fullBrightMin: number = 75;
        private fullBrightMax: number = 285;
        private maxIntensity: number = 3;

        constructor(renderer: WebGLRenderer, scene: Scene, level: Level, renderDistance: number, chunkSize: number) {
            this.level = level;
            this.scene = scene;
            this.radius = renderDistance * chunkSize * 3;
            this.renderer = renderer;
            this.config.exposure = this.renderer.toneMappingExposure;

            const vertexShader = ShaderHelper.load("environment/sky_vertex");
            const fragmentShader = ShaderHelper.load("environment/sky_fragment");

            const material = new ShaderMaterial({
                name: 'SkyShader',
                fragmentShader: fragmentShader,
                vertexShader: vertexShader,
                uniforms: UniformsUtils.clone(this.uniforms),
                side: BackSide,
                depthWrite: false
            });

            this.mesh = new Mesh(new BoxGeometry(1, 1, 1), material);
            this.mesh.scale.setScalar(this.scalar);

            scene.add(this.mesh);

            this.light = new DirectionalLight(0xffa95c,this.maxIntensity);
            this.light.position.set(0,1,0);
            this.light.castShadow = true;
            //this.light.shadow.bias = -0.0001;
            this.light.shadow.mapSize.width = 512 * 8;
            this.light.shadow.mapSize.height = 512 * 8;

            let d = 32;
            let db = 64;

            this.light.shadow.camera.left = -d;
            this.light.shadow.camera.right = d;
            this.light.shadow.camera.top = db;
            this.light.shadow.camera.bottom = -db;
            scene.add(this.light);

            let helper = new DirectionalLightHelper(this.light);
            scene.add(helper);

            this.update();
        }

        public update() {
            const uniforms = (<ShaderMaterial>this.mesh.material).uniforms;
            uniforms['turbidity'].value = this.config.turbidity;
            uniforms['rayleigh'].value = this.config.rayleigh;
            uniforms['mieCoefficient'].value = this.config.mieCoefficient;
            uniforms['mieDirectionalG'].value = this.config.mieDirectionalG;

            const phi = MathUtils.degToRad(this.config.elevation);
            const theta = MathUtils.degToRad(this.config.azimuth);

            this.sun.setFromSphericalCoords(1, phi, theta);

            uniforms['sunPosition'].value.copy(this.sun);

            this.renderer.toneMappingExposure = this.config.exposure;

            this.light.position.setFromSphericalCoords(this.radius,phi,theta);

            let deg = this.config.elevation;
            if(deg >= this.fullBrightMin){
                if(deg < 90) {
                    let intensity = Math.abs(this.maxIntensity - MathUtilities.Utils.scaleBetween(deg, 0,this.maxIntensity,this.fullBrightMin, 90));
                    this.light.intensity = intensity;
                } else{
                    if(deg <= this.fullBrightMax) {
                        if (deg > 270) {
                            let intensity = MathUtilities.Utils.scaleBetween(deg, 0, this.maxIntensity, 270, this.fullBrightMax);
                            this.light.intensity = intensity;
                        } else {
                            this.light.intensity = 0
                        }
                    }else{
                        this.light.intensity = this.maxIntensity;
                    }
                }
            } else{
                this.light.intensity = this.maxIntensity;
            }
        }

        public setSkyPos(deg: number){
            this.config.elevation = deg % 360;
            if(this.config.elevation < 0){
                this.config.elevation += 360;
            }
            this.update()
        }

        public updatePos(vec: Vec3){
            this.mesh.position.x = vec.x;
            this.mesh.position.z = vec.z;

            const phi = MathUtils.degToRad(this.config.elevation);
            const theta = MathUtils.degToRad(this.config.azimuth);
            this.light.position.setFromSphericalCoords(this.radius,phi,theta);
            this.light.position.add(new Vector3(vec.x,this.level.seaLevel,vec.z));
            this.light.target.position.x = vec.x;
            this.light.target.position.z = vec.z;
            this.light.target.updateMatrixWorld();
        }

        public applyLights(enabled?: boolean){
            if(enabled && enabled == this.lightEnabled){
                return
            }

            if(!enabled){
                enabled = !this.lightEnabled;
            }

            if(enabled){
                this.scene.add(this.light);
            }else{
                this.light.removeFromParent();
            }

            this.lightEnabled = enabled;
        }
    }

    /*

        private readonly mesh: Mesh;
        private readonly geometry: BoxBufferGeometry;

        constructor(scene: Scene, renderDistance: number, chunkSize: number) {
            scene.background = MaterialHelper.makeSkyboxTextures();
            //let size = (renderDistance * chunkSize) * 2;
            //this.geometry = new BoxBufferGeometry(size,size,size);

        }

        public update(position: Vec3){
            //this.mesh.position.x = position.x;
            //this.mesh.position.y = position.y;
            //this.mesh.position.z = position.z;
        }
     */
}