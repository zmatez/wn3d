import {Vec3Base} from "./Vec3Base";

export namespace Directions {

    export enum RelativeDirection {
        FORWARD, BACKWARD, LEFT, RIGHT
    }

    enum AxisEnum {
        X, Y, Z
    }

    export class Axis {
        public static readonly X = new Axis(AxisEnum.X);
        public static readonly Y = new Axis(AxisEnum.Y);
        public static readonly Z = new Axis(AxisEnum.Z);

        public static readonly values: Axis[] = [Axis.X, Axis.Y, Axis.Z];

        private readonly _axis: AxisEnum;

        constructor(axis: AxisEnum) {
            this._axis = axis;
        }

        get axis(): AxisEnum {
            return this._axis;
        }
    }

    export class Direction {
        public static readonly UP: Direction = new Direction('up', Axis.Y, new Vec3Base.Vec3Base(0, 1, 0));
        public static readonly DOWN: Direction = new Direction('down', Axis.Y, new Vec3Base.Vec3Base(0, -1, 0));
        public static readonly NORTH: Direction = new Direction('north', Axis.Z, new Vec3Base.Vec3Base(0, 0, -1));
        public static readonly SOUTH: Direction = new Direction('south', Axis.Z, new Vec3Base.Vec3Base(0, 0, 1));
        public static readonly WEST: Direction = new Direction('west', Axis.X, new Vec3Base.Vec3Base(-1, 0, 0));
        public static readonly EAST: Direction = new Direction('east', Axis.X, new Vec3Base.Vec3Base(1, 0, 0));

        public static readonly values: Direction[] = [Direction.UP, Direction.DOWN, Direction.NORTH, Direction.SOUTH, Direction.WEST, Direction.EAST];

        private readonly _name: string;
        private readonly _axis: Axis;
        private readonly _difference: Vec3Base.Vec3Base;

        constructor(name: string, axis: Axis, difference: Vec3Base.Vec3Base) {
            this._name = name;
            this._axis = axis;
            this._difference = difference;
        }

        get name(): string {
            return this._name;
        }

        get axis(): Directions.Axis {
            return this._axis;
        }

        get difference(): Vec3Base.Vec3Base {
            return this._difference;
        }

        get opposite(): Direction {
            if (this == Direction.UP) {
                return Direction.DOWN;
            } else if (this == Direction.DOWN) {
                return Direction.UP;
            } else if (this == Direction.NORTH) {
                return Direction.SOUTH;
            } else if (this == Direction.SOUTH) {
                return Direction.NORTH;
            } else if (this == Direction.EAST) {
                return Direction.WEST;
            } else if (this == Direction.WEST) {
                return Direction.EAST;
            }
        }
    }
}