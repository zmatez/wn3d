export namespace UI {
    export class GUI {
        public static ASSETS: string = "assets/";

        public element: HTMLDivElement;
        public debug: HTMLDivElement;
        public pointer: HTMLDivElement;
        public stats: HTMLDivElement;
        public progress: HTMLDivElement;

        private debugErrored: boolean = false;

        constructor() {
            this.element = <HTMLDivElement>document.getElementsByClassName('gui')[0];
        }

        create() {
            this.debug = document.createElement('div');
            this.debug.classList.add("debug-info");
            this.element.appendChild(this.debug);

            this.stats = document.createElement('div');
            this.stats.classList.add("stats");
            this.element.appendChild(this.stats);

            this.pointer = document.createElement('div');
            this.pointer.classList.add("pointer");
            let pointerImg = document.createElement('img');
            pointerImg.src = GUI.ASSETS + "textures/gui/pointer.png";
            this.pointer.appendChild(pointerImg);
            this.element.appendChild(this.pointer);
        }

        setDebugText(text: string) {
            this.debug.innerHTML = text;
            this.debugErrored = false;
            this.debug.classList.remove("error");
        }

        debugError() {
            if (!this.debugErrored) {
                this.debugErrored = true;
                this.debug.classList.add("error");
            }
        }

        setLoadingProgress(percentage: number, readyCallback: () => void) {
            if (percentage >= 100) {
                if (this.progress) {
                    setTimeout(() => {
                        this.progress.classList.add("close");
                        setTimeout(() => {
                            this.progress.remove();
                            readyCallback()
                        }, 250)
                    }, 200)
                }
            }

            if (!this.progress) {
                this.progress = document.createElement('div');
                this.progress.classList.add("progress-box");

                let image = document.createElement('img');
                image.src = GUI.ASSETS + "logos/logo.png";
                image.classList.add("image");
                this.progress.appendChild(image);

                let title = document.createElement("h1");
                title.innerHTML = "WildNature 3D";
                title.classList.add("title");
                this.progress.appendChild(title);

                let barOuter = document.createElement('div');
                barOuter.classList.add("bar-outer");
                this.progress.appendChild(barOuter);
                let barInner = document.createElement('div');
                barInner.classList.add("bar-inner");
                barInner.style.width = percentage + "%";
                barOuter.appendChild(barInner);

                this.element.appendChild(this.progress);
            } else {
                (<HTMLDivElement>this.progress.getElementsByClassName('bar-inner')[0]).style.width = percentage + "%";
            }
        }
    }
}