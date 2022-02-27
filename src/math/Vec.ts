import {Directions} from "./Directions";
import {Vec3Base} from "./Vec3Base";
import {Levels} from "../world/Levels";

export namespace Vec {
    import Axis = Directions.Axis;
    import Direction = Directions.Direction;

    export class Vec3 extends Vec3Base.Vec3Base {
        public static create(x: number, y: number, z: number): Vec3 {
            return new Vec3(x, y, z);
        }

        public static deserialize(pos: string): Vec3 | BlockPos {
            let type = pos.charAt(0);

            let split = pos.substr(1).split("=");

            try {
                if (type == "B") {
                    return new BlockPos(parseInt(split[0]), parseInt(split[1]), parseInt(split[2]));
                } else {
                    return new Vec3(parseFloat(split[0]), parseFloat(split[1]), parseFloat(split[2]));
                }
            } catch (e) {
                return null;
            }
        }

        public relative(x: number, y: number, z: number): Vec3 {
            return this.create(this.x + x, this.y + y, this.z + z);
        }

        public above(amount: number): Vec3 {
            return this.relative(0, amount, 0);
        }

        public below(amount: number): Vec3 {
            return this.relative(0, -amount, 0);
        }

        public offset(direction: Direction, amount: number) {
            return this.create(this.x + (amount * direction.difference.x), this.y + (amount * direction.difference.y), this.z + (amount * direction.difference.z));
        }

        public compare(vec: Vec3): boolean {
            return this.x === vec.x && this.y === vec.y && this.z === vec.z;
        }

        public serialize(): string {
            return "V" + this.x + "=" + this.y + "=" + this.z;
        }

        protected create(x: number, y: number, z: number): Vec3 {
            return Vec3.create(x, y, z);
        }
    }

    export class BlockPos extends Vec3 {
        public get aabb(): AABB {
            return new AABB(this, this.relative(1, 1, 1));
        }

        public static of(vec3: Vec3): BlockPos {
            return BlockPos.create(vec3.x, vec3.y, vec3.z);
        }

        public static create(x: number, y: number, z: number): BlockPos {
            return new BlockPos(Math.floor(x), Math.floor(y), Math.floor(z));
        }

        public serialize(): string {
            return "B" + this.x + "=" + this.y + "=" + this.z;
        }

        relative(x: number, y: number, z: number): BlockPos {
            return <BlockPos>super.relative(x, y, z);
        }

        below(amount: number): BlockPos {
            return <BlockPos>super.below(amount);
        }

        above(amount: number): BlockPos {
            return <BlockPos>super.above(amount);
        }

        offset(direction: Directions.Direction, amount: number): BlockPos {
            return <BlockPos>super.offset(direction, amount);
        }

        protected create(x: number, y: number, z: number): BlockPos {
            return BlockPos.create(x, y, z);
        }
    }

    export class AABB {
        public min: Vec3;
        public max: Vec3;

        constructor(pos1: Vec3, pos2: Vec3) {
            this.min = AABB.min(pos1, pos2);
            this.max = AABB.max(pos1, pos2);
        }

        private static min(pos1: Vec3, pos2: Vec3): Vec3 {
            return new Vec3(Math.min(pos1.x, pos2.x), Math.min(pos1.y, pos2.y), Math.min(pos1.z, pos2.z));
        }

        private static max(pos1: Vec3, pos2: Vec3): Vec3 {
            return new Vec3(Math.max(pos1.x, pos2.x), Math.max(pos1.y, pos2.y), Math.max(pos1.z, pos2.z));
        }

        public intersects(aabb: AABB): boolean {
            return (this.min.x <= aabb.max.x && this.max.x >= aabb.min.x) &&
                (this.min.y <= aabb.max.y && this.max.y >= aabb.min.y) &&
                (this.min.z <= aabb.max.z && this.max.z >= aabb.min.z);
        }

        public getAt(direction: Direction): AABB {
            let vec = direction.difference;

            let pos1, pos2;

            if (direction.axis == Axis.X) {
                let val = vec.x;
                if (val > 0) {
                    pos1 = Vec3.create(Math.max(this.min.x, this.max.x), this.min.y, this.min.z);
                    pos2 = Vec3.create(Math.max(this.min.x, this.max.x), this.max.y, this.max.z);
                } else {
                    pos1 = Vec3.create(Math.min(this.min.x, this.max.x), this.min.y, this.min.z);
                    pos2 = Vec3.create(Math.min(this.min.x, this.max.x), this.max.y, this.max.z);
                }
            } else if (direction.axis == Axis.Y) {
                let val = vec.y;
                if (val > 0) {
                    pos1 = Vec3.create(this.min.x, Math.max(this.min.y, this.max.y), this.min.z);
                    pos2 = Vec3.create(this.max.x, Math.max(this.min.y, this.max.y), this.max.z);
                } else {
                    pos1 = Vec3.create(this.min.x, Math.min(this.min.y, this.max.y), this.min.z);
                    pos2 = Vec3.create(this.max.x, Math.min(this.min.y, this.max.y), this.max.z);
                }
            } else if (direction.axis == Axis.Z) {
                let val = vec.y;
                if (val > 0) {
                    pos1 = Vec3.create(this.min.x, this.min.y, Math.max(this.min.z, this.max.z));
                    pos2 = Vec3.create(this.max.x, this.max.y, Math.max(this.min.z, this.max.z));
                } else {
                    pos1 = Vec3.create(this.min.x, this.min.y, Math.min(this.min.z, this.max.z));
                    pos2 = Vec3.create(this.max.x, this.max.y, Math.min(this.min.z, this.max.z));
                }
            }

            return new AABB(pos1, pos2);
        }
    }

    export class ChunkPos {
        readonly x: number;
        readonly z: number;

        constructor(x: number, z: number) {
            this.x = x;
            this.z = z;
        }

        public static deserialize(serial: string): ChunkPos {
            let str = serial.split("=");
            return new ChunkPos(parseInt(str[0]), parseInt(str[1]));
        }

        public static fromBlockPos(pos: BlockPos): ChunkPos {
            return new ChunkPos(pos.x >> 4, pos.z >> 4);
        }

        public relativeBlockPos(pos: BlockPos): BlockPos {
            let relX = (pos.x - (this.x * Levels.Chunk.CHUNK_SIZE))
            let relZ = (pos.z - (this.z * Levels.Chunk.CHUNK_SIZE))

            return new BlockPos(relX, pos.y, relZ);
        }

        public serialize(): string {
            return this.x + "=" + this.z;
        }

        public relative(x: number, z: number): ChunkPos {
            return new ChunkPos(this.x + x, this.z + z);
        }

        public equals(pos: ChunkPos) {
            return this.x == pos.x && this.z == pos.z;
        }
    }
}