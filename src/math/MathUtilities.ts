export namespace MathUtilities {
    export class Utils {
        public static removeFromArray(array: any[], item: any): void {
            const index = array.indexOf(item);
            if (index > -1) {
                array.splice(index, 1);
            }
        }

        public static rint(min: number, max: number): number {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }

        public static rfloat(min: number, max: number): number {
            return (Math.random() * (max - min + 1) + min);
        }

        public static scaleBetween(unscaledNum: number, minAllowed: number, maxAllowed: number, min: number, max: number): number {
            return (maxAllowed - minAllowed) * (unscaledNum - min) / (max - min) + minAllowed;
        }
    }
}