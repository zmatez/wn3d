export namespace Vec3Base {
    export class Vec3Base {
        readonly x: number;
        readonly y: number;
        readonly z: number;

        constructor(x: number, y: number, z: number) {
            if (isNaN(x) || isNaN(y) || isNaN(z)) {
                throw new Error("Vector not fully defined: " + x + ", " + y + ", " + z);
            }
            this.x = x;
            this.y = y;
            this.z = z;
        }
    }
}