import * as THREE from "three";
import {Levels} from "../world/Levels";
import {Vec} from "../math/Vec";
import {Directions} from "../math/Directions";
import {Blocks} from "../block/Blocks";
import {Matrix4} from "three";
import {App} from "./main";
//import {PointerLockControls} from 'three/examples/jsm/controls/PointerLockControls';

export namespace Controls {
    import Level = Levels.Level;
    import Vec3 = Vec.Vec3;
    import BlockPos = Vec.BlockPos;
    import RelativeDirection = Directions.RelativeDirection;
    import AABB = Vec.AABB;
    import Axis = Directions.Axis;
    import Direction = Directions.Direction;
    import BlockState = Blocks.BlockState;

    export class Player {
        public readonly app: App;
        public readonly camera: THREE.PerspectiveCamera;
        public readonly controls: PointerLockControls;
        public readonly level: Level;
        public raycaster: THREE.Raycaster;
        public centerPoint: THREE.Vector2 = new THREE.Vector2();
        private pressedSpace: boolean = false;
        private unpressedSpace: boolean = false;
        private sprinting: boolean = false;

        public movement: {
            forward: number,
            backward: number,
            left: number,
            right: number,
            up: number,
            down: number
        } = {
            forward: 0,
            backward: 0,
            left: 0,
            right: 0,
            up: 0,
            down: 0
        }

        public readonly fovNormal = 75;
        public readonly fovSprint = 85;
        public readonly fovChange = 1.2;
        public fov: number;
        public desiredFov: number;

        public friction: number = 0.006;
        public flyingFriction: number = 0.0035;
        public movingSpeed: number = 0.1;
        public sprintModifier: number = 1.4;
        public flyModifier: number = 1.4;
        public maxYForce: number = 0.5;
        public yForce: number = 0;
        public jumpForce: number = 0.13;
        public flyForce: number = 0.13;
        public rayRange: number = 5;

        public height: number = 1.45;
        public cameraOffset: number = 1 / 3;
        public eyePos: number = 1.25;
        public thickness: number = 0.8;

        public onGround: boolean = false;
        public flying: boolean = false;

        private activeKeys: string[] = [];

        private prevPos: Vec3;
        public look: { block: BlockState, vec: Vec3 };
        private oldLook: { block: BlockState, vec: Vec3 };

        private mesh: THREE.LineSegments;
        private hlGeometry: THREE.EdgesGeometry;
        private readonly hlMaterial: THREE.Material = new THREE.LineBasicMaterial({color: 0x000000, linewidth: 3});
        private hlMesh: THREE.LineSegments;

        constructor(scene: THREE.Scene, level: Level, camera: THREE.PerspectiveCamera, app: App) {
            this.app = app;
            this.level = level;
            this.camera = camera;
            this.camera.position.y = 32;
            this.camera.rotation.order = 'YXZ';
            this.controls = new PointerLockControls(camera, document.body);
            this.prevPos = new Vec3(this.camera.position.x, this.camera.position.y, this.camera.position.z);

            this.raycaster = new THREE.Raycaster();

            this.fov = this.camera.fov;
            this.desiredFov = this.fovNormal;

            //
            let blockBox = new THREE.BoxBufferGeometry(0, 0, 0);
            let edges = new THREE.EdgesGeometry(blockBox);
            let material = new THREE.LineBasicMaterial({color: 0xff0000});
            this.mesh = new THREE.LineSegments(edges, material);
            scene.add(this.mesh);
            //

            document.body.addEventListener('click', () => {
                this.controls.lock();
            })

            this.controls.addEventListener('lock', () => {
            })
            this.controls.addEventListener('unlock', () => {
            });

            document.addEventListener('keydown', (e) => {
                this.activeKeys.push(e.key);
                this.sprinting = e.ctrlKey;
                this.onKey(e.key,true);
            });
            document.addEventListener('keyup', (e) => {
                this.activeKeys = this.activeKeys.filter(key => key != e.key);
                this.sprinting = e.ctrlKey;
                this.onKey(e.key,false);
            });

            this.centerPoint.x = ((window.innerWidth / 2) / window.innerWidth) * 2 - 1;
            this.centerPoint.y = -((window.innerHeight / 2) / window.innerHeight) * 2 + 1;
        }

        public onKey(key: string, down: boolean) {
            if (key == " ") {
                if(down) {
                    if (this.pressedSpace && this.unpressedSpace) {
                        this.flying = !this.flying;
                    } else {
                        this.pressedSpace = true;
                        setTimeout(() => {
                            this.pressedSpace = false;
                        }, 250)
                    }
                    this.unpressedSpace = false;
                }else{
                    this.unpressedSpace = true;
                }
            } else if(key == "l"){
                if(down) {
                    this.app.skyBox.applyLights();
                }
            } else if(key == ","){
                if(down) {
                    this.app.sunPos += 1;
                    this.app.skyBox.setSkyPos(this.app.sunPos)
                }
            } else if(key == "."){
                if(down) {
                    this.app.sunPos -= 1;
                    this.app.skyBox.setSkyPos(this.app.sunPos)
                }
            }
        }

        public update() {
            this.onGround = this.isOnGround();
            if (this.onGround) {
                this.flying = false;
            }

            let flyVal = this.flying ? this.flyModifier : 1;
            let sprintVal = this.sprinting ? this.sprintModifier * this.flyModifier : 1;

            if (this.activeKeys.includes("w")) {
                this.forward(this.movingSpeed * sprintVal * flyVal);
            }
            if (this.activeKeys.includes("a")) {
                this.left(this.movingSpeed * sprintVal * flyVal);
            }
            if (this.activeKeys.includes("d")) {
                this.right(this.movingSpeed * sprintVal * flyVal);
            }
            if (this.activeKeys.includes("s")) {
                this.backward(this.movingSpeed * sprintVal * flyVal);
            }

            let moved = this.move();
            if(moved){
                if(this.sprinting){
                    this.setFOV(this.fovSprint);
                }else{
                    this.setFOV(this.fovNormal);
                }
            }
            this.updateFOV();

            //this.checkCollisions();

            if (!this.flying) {
                if (this.onGround) {
                    if (this.yForce != 0) {
                        this.camera.position.y = this.prevPos.y;
                    }
                    this.yForce = 0;

                    if (this.activeKeys.includes(" ")) {
                        this.yForce = this.jumpForce;
                    }
                } else {
                    if (this.yForce != -this.maxYForce) {
                        this.yForce -= this.level.gravity;
                        this.yForce = Math.max(this.yForce, -this.maxYForce);
                    }
                }
            } else {
                this.yForce = 0;
                if (this.activeKeys.includes(" ")) {
                    this.flyUp(this.flyForce)
                }
                if (this.activeKeys.includes("Shift")) {
                    this.flyDown(this.flyForce)
                }
            }

            this.camera.position.y += this.yForce;

            //this.findLookPos();
            //-----
            this.prevPos = new Vec3(this.camera.position.x, this.camera.position.y, this.camera.position.z);
        }

        public tick(){
            //this.findLookPos();
        }

        public render(scene: THREE.Scene) {
            // let aabb = this.aabb;
            // this.mesh.position.x = aabb.min.x;
            // this.mesh.position.y = aabb.min.y + (aabb.max.y - aabb.min.y) / 2;
            // this.mesh.position.z = aabb.min.z;
            //
            // this.mesh.geometry = new THREE.EdgesGeometry(new THREE.BoxBufferGeometry(aabb.max.x - aabb.min.x, aabb.max.y - aabb.min.y, aabb.max.z - aabb.min.z));

            if (this.look == null) {
                if (this.hlMesh != null) {
                    this.hlMesh.removeFromParent();
                    this.hlMesh = null;
                }
            } else {
                if (this.hlMesh == null || (this.oldLook && this.look.block != this.oldLook.block)) {
                    if (this.hlMesh != null) {
                        this.hlMesh.removeFromParent();
                    }
                    this.hlGeometry = new THREE.EdgesGeometry(this.look.block.block.geometry);
                    this.hlMesh = new THREE.LineSegments(this.hlGeometry, this.hlMaterial);

                    let diff = Blocks.Block.BLOCK_SIZE / 2;
                    let pos = this.look.block.pos;

                    this.hlMesh.position.x = pos.x + diff;
                    this.hlMesh.position.y = pos.y;
                    this.hlMesh.position.z = pos.z + diff;

                    scene.add(this.hlMesh);
                }
            }
        }

        public forward(speed: number) {
            this.movement.forward = speed;
            this.movement.backward = 0;
        }

        public left(speed: number) {
            this.movement.left = speed;
            this.movement.right = 0;
        }

        public right(speed: number) {
            this.movement.right = speed;
            this.movement.left = 0;
        }

        public backward(speed: number) {
            this.movement.backward = speed;
            this.movement.forward = 0;
        }

        public flyUp(speed: number) {
            this.movement.up = speed;
            this.movement.down = 0;
        }

        public flyDown(speed: number) {
            this.movement.down = speed;
            this.movement.up = 0;
        }

        public setFOV(fov: number){
            this.desiredFov = fov;
        }

        public updateFOV(){
            if(this.desiredFov != this.fov){
                if(this.desiredFov > this.fov){
                    this.fov = Math.min(this.desiredFov, this.fov + this.fovChange);
                } else {
                    this.fov = Math.max(this.desiredFov, this.fov - this.fovChange);
                }

                this.camera.fov = this.fov;
                this.camera.updateProjectionMatrix();
                console.log("FOV: " + this.camera.fov)
            }
        }

        public move(): boolean{
            let moved = false;
            let friction = this.flying ? this.flyingFriction : this.friction;

            if(this.movement.forward != 0) {
                this.controls.moveForward(this.movement.forward);
                this.movement.forward = Math.max(0,this.movement.forward - friction);
                moved = true;
            }
            if(this.movement.backward != 0) {
                this.controls.moveForward(-this.movement.backward);
                this.movement.backward = Math.max(0,this.movement.backward - friction);
                moved = true;
            }
            if(this.movement.right != 0) {
                this.controls.moveRight(this.movement.right);
                this.movement.right = Math.max(0,this.movement.right - friction);
                moved = true;
            }
            if(this.movement.left != 0) {
                this.controls.moveRight(-this.movement.left);
                this.movement.left = Math.max(0,this.movement.left - friction);
                moved = true;
            }

            if(this.movement.up != 0) {
                this.camera.position.y += this.movement.up
                this.movement.up = Math.max(0,this.movement.up - friction);
            }
            if(this.movement.down != 0) {
                this.camera.position.y += -this.movement.down
                this.movement.down = Math.max(0,this.movement.down - friction);
            }

            return moved;
        }

        public get onPos(): Vec3 {
            return new Vec3(this.camera.position.x, this.camera.position.y - this.eyePos, this.camera.position.z);
        }

        public get onBlockPos(): BlockPos {
            return BlockPos.of(this.onPos);
        }

        public get rotation(): { x: number, y: number } {
            return {
                x: THREE.MathUtils.radToDeg(this.camera.rotation.x),
                y: THREE.MathUtils.radToDeg(this.camera.rotation.y),
            }
        }

        public get lookDir(): Direction {
            let rot = this.rotation;
            let horiz = rot.y;
            let vert = rot.x;
            if (vert > 45) {
                return Direction.UP
            } else if (vert < -45) {
                return Direction.DOWN;
            }

            if (horiz < 45 && horiz > -45) {
                return Direction.NORTH;
            } else if (horiz < -45 && horiz > -135) {
                return Direction.EAST;
            } else if (horiz > 45 && horiz < 135) {
                return Direction.WEST;
            } else {
                return Direction.SOUTH;
            }
        }

        public get aabb(): AABB {
            let pos = this.onPos;
            return new AABB(pos, pos.relative(this.thickness, this.height, this.thickness));
        }

        public checkCollisions() {
            let playerPos = this.onBlockPos;
            let player = this.aabb;
            this.level.forEachBlockNear(playerPos, 2, 3, (state, pos) => {
                if (state.block != Blocks.AIR) {
                    let aabb = pos.aabb;

                    if (aabb.getAt(Direction.NORTH).intersects(player)) {
                        //this.camera.position.z = this.prevPos.z;
                    }
                }
                return true;
            });
        }

        public isOnGround(): boolean {
            let collides = false;
            let playerPos = this.onBlockPos;

            let player = this.aabb; // max = 0, min = -1.8
            this.level.forEachBlockNear(playerPos, 2, 0, (state, pos) => {
                if (state.block != Blocks.AIR) {
                    let aabb = pos.aabb;
                    // max = -2, min = -3
                    if (aabb.min.y <= player.min.y) {
                        if (aabb.intersects(player)) {
                            collides = true;
                        }
                    }
                }

                return !collides;
            });

            return collides;
        }

        public findLookPos() {
            this.oldLook = this.look;
            this.raycaster.setFromCamera(this.centerPoint, this.camera);
            let minDistance = null;
            let minPosition: THREE.Vector3 = null;
            Blocks.Block.BLOCKS.forEach((block) => {
                block.meshes.forEach(iMesh => {
                    let mesh = iMesh.mesh;
                    let intersection = this.raycaster.intersectObject(mesh);
                    if (intersection.length > 0) {
                        let position = intersection[0].point;
                        let distance = intersection[0].distance;

                        if (distance <= this.rayRange) {
                            if (minDistance == null || minDistance > distance) {
                                minDistance = distance;
                                minPosition = position;
                            }
                        }
                    }
                })
            })

            if (!minDistance) {
                this.look = null;
            } else {
                let vec = new Vec3(minPosition.x, minPosition.y, minPosition.z);
                let pos = BlockPos.of(vec);
                let block = this.level.getBlock(pos);
                if (block.block != Blocks.AIR) {
                    this.look = {block: block, vec: vec};
                } else {
                    this.look = null;
                }
            }
        }
    }

    //! -----------------------------------------------------

    const _changeEvent = {type: 'change'};
    const _lockEvent = {type: 'lock'};
    const _unlockEvent = {type: 'unlock'};

    const _PI_2 = Math.PI / 2;

    class PointerLockControls extends THREE.EventDispatcher {
        domElement: HTMLElement;
        camera: THREE.Camera;
        isLocked = false;

        minPolarAngle = 0; // radians
        maxPolarAngle = Math.PI; // radians

        vector = new THREE.Vector3();
        euler = new THREE.Euler(0, 0, 0, 'YXZ');

        previousTouch?: Touch;

        onMouseMoveBind = this.onMouseMove.bind(this);
        onPointerlockChangeBind = this.onPointerlockChange.bind(this);
        onPointerlockErrorBind = this.onPointerlockError.bind(this);
        onTouchMoveBind = this.onTouchMove.bind(this);
        onTouchEndBind = this.onTouchEnd.bind(this);

        constructor(camera: THREE.Camera, domElement: HTMLElement) {
            super();

            if (domElement === undefined) {
                console.warn(
                    'THREE.PointerLockControls: The second parameter "domElement" is now mandatory.'
                );
                domElement = document.body;
            }

            this.camera = camera;
            this.domElement = domElement;

            this.connect();
        }

        onTouchMove(e: TouchEvent) {
            let touch: Touch | undefined;

            switch (e.touches.length) {
                case 1:
                    if (e.touches[0].target === this.domElement) touch = e.touches[0];
                    break;
                case 2:
                    if (e.touches[0].target === this.domElement) touch = e.touches[0];
                    else if (e.touches[1].target === this.domElement) touch = e.touches[1];
                    break;
            }

            if (!touch) return;

            console.log(touch.target);

            const movementX = this.previousTouch
                ? touch.pageX - this.previousTouch.pageX
                : 0;
            const movementY = this.previousTouch
                ? touch.pageY - this.previousTouch.pageY
                : 0;

            this.updatePosition(movementX, movementY, 0.004);

            this.previousTouch = touch;
        }

        onTouchEnd() {
            this.previousTouch = undefined;
        }

        onMouseMove(event: MouseEvent) {
            if (this.isLocked === false) return;

            const movementX: number =
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                event.movementX || event.mozMovementX || event.webkitMovementX || 0;
            const movementY: number =
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                event.movementY || event.mozMovementY || event.webkitMovementY || 0;

            this.updatePosition(movementX, movementY, 0.002);
        }

        updatePosition(movementX: number, movementY: number, multiplier: number) {
            this.euler.setFromQuaternion(this.camera.quaternion);

            this.euler.y -= movementX * multiplier;
            this.euler.x -= movementY * multiplier;

            this.euler.x = Math.max(
                _PI_2 - this.maxPolarAngle,
                Math.min(_PI_2 - this.minPolarAngle, this.euler.x)
            );

            this.camera.quaternion.setFromEuler(this.euler);

            this.dispatchEvent(_changeEvent);
        }

        onPointerlockChange() {
            if (this.domElement.ownerDocument.pointerLockElement === this.domElement) {
                this.dispatchEvent(_lockEvent);

                this.isLocked = true;
            } else {
                this.dispatchEvent(_unlockEvent);

                this.isLocked = false;
            }
        }

        onPointerlockError() {
            console.error('THREE.PointerLockControls: Unable to use Pointer Lock API');
        }

        connect() {
            this.domElement.addEventListener('touchmove', this.onTouchMoveBind, false);
            this.domElement.addEventListener('touchend', this.onTouchEndBind, false);
            this.domElement.ownerDocument.addEventListener(
                'mousemove',
                this.onMouseMoveBind
            );
            this.domElement.ownerDocument.addEventListener(
                'pointerlockchange',
                this.onPointerlockChangeBind
            );
            this.domElement.ownerDocument.addEventListener(
                'pointerlockerror',
                this.onPointerlockErrorBind
            );
        }

        disconnect() {
            this.domElement.removeEventListener(
                'touchmove',
                this.onTouchMoveBind,
                false
            );
            this.domElement.removeEventListener('touchend', this.onTouchEndBind, false);
            this.domElement.ownerDocument.removeEventListener(
                'mousemove',
                this.onMouseMoveBind
            );
            this.domElement.ownerDocument.removeEventListener(
                'pointerlockchange',
                this.onPointerlockChangeBind
            );
            this.domElement.ownerDocument.removeEventListener(
                'pointerlockerror',
                this.onPointerlockErrorBind
            );
        }

        dispose() {
            this.disconnect();
        }

        getObject() {
            return this.camera;
        }

        getDirection() {
            const direction = new THREE.Vector3(0, 0, -1);

            return (v: THREE.Vector3) => {
                return v.copy(direction).applyQuaternion(this.camera.quaternion);
            };
        }

        moveForward(distance: number) {
            this.vector.setFromMatrixColumn(this.camera.matrix, 0);

            this.vector.crossVectors(this.camera.up, this.vector);

            this.camera.position.addScaledVector(this.vector, distance);
        }

        moveRight(distance: number) {
            this.vector.setFromMatrixColumn(this.camera.matrix, 0);

            this.camera.position.addScaledVector(this.vector, distance);
        }

        lock() {
            if (typeof this.domElement.requestPointerLock !== 'undefined')
                this.domElement.requestPointerLock();
        }

        unlock() {
            if (typeof this.domElement.requestPointerLock !== 'undefined')
                this.domElement.ownerDocument.exitPointerLock();
        }
    }

}