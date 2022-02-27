export namespace Utilities {
    export class Utils {
        public static getSync(path: string): string | null {
            let request = new XMLHttpRequest();
            request.open('GET', path, false);
            request.send(null);

            if (request.status === 200) {
                return request.responseText;
            }

            return null;
        }
    }
}