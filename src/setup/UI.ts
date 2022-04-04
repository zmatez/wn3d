import {MathUtilities} from "../math/MathUtilities";

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

        setLoadingProgress(percentage: number, canClose: boolean, text: string, readyCallback: () => void) {
            if (percentage >= 100) {
                if (canClose) {
                    if (this.progress) {
                        setTimeout(() => {
                            this.progress.classList.add("close");
                            setTimeout(() => {
                                this.progress.remove();
                                readyCallback()
                            }, 250)
                        }, 200)
                    }
                } else {
                    readyCallback()
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


                let status = document.createElement("span");
                status.innerHTML = text;
                status.classList.add("status");
                this.progress.appendChild(status);

                this.element.appendChild(this.progress);
            } else {
                (<HTMLDivElement>this.progress.getElementsByClassName('bar-inner')[0]).style.width = percentage + "%";
                (<HTMLSpanElement>this.progress.getElementsByClassName('status')[0]).innerHTML = text;
            }
        }
    }

    export class StartMenu {
        public element: HTMLDivElement;
        public menu: HTMLDivElement;
        private readyCallback: (simulationDistance: number, renderDistance: number) => void;

        private simulationDistance: number;
        private renderDistance: number;

        constructor() {
            this.element = <HTMLDivElement>document.getElementsByClassName('gui')[0];
        }

        construct() {
            this.menu = document.createElement('div');
            this.menu.classList.add("menu-box");

            let titleBar = document.createElement('div');
            titleBar.classList.add("title-bar");
            {
                let image = document.createElement('img');
                image.src = GUI.ASSETS + "logos/wn_website_logo.svg";
                image.classList.add("image");
                titleBar.appendChild(image);

                let title = document.createElement("h1");
                title.innerHTML = "WildNature 3D";
                title.classList.add("title");
                titleBar.appendChild(title);

                let customizer = document.createElement('div');
                customizer.classList.add("customizer");
                customizer.innerHTML = "Customizer";
                titleBar.appendChild(customizer);
            }
            this.menu.appendChild(titleBar);

            //
            let options = document.createElement('div');
            options.classList.add("options");
            this.menu.appendChild(options);
            //

            let buttonBar = document.createElement('div');
            buttonBar.classList.add("button-bar");
            {
                let button = document.createElement("div");
                button.innerHTML = "Generate";
                button.classList.add("button");
                buttonBar.appendChild(button);
                button.addEventListener('click', () => {
                    this.menu.remove();
                    this.readyCallback(this.simulationDistance,this.renderDistance)
                })

            }
            this.menu.appendChild(buttonBar);

            this.element.appendChild(this.menu);

            //-----------------
            let simulationDistance: Slider = null;
            let simChanged = (val: number) => {};
            options.appendChild(this.makeOption("Simulation Distance", (parent, valueChanger) => {
                simulationDistance = new Slider(parent, 4, 32, 10);
                simulationDistance.listener = (value) => {
                    valueChanger(Math.round(value));
                    simChanged(value);
                    this.simulationDistance = Math.round(value);
                }
                simulationDistance.construct();
            }))
            options.appendChild(this.makeOption("Render Distance", (parent, valueChanger) => {
                let renderDistance = new Slider(parent, 2, 24, 8);
                renderDistance.listener = (value) => {
                    let simVal = Math.round(simulationDistance.value) - 2;
                    let val = Math.min(simVal,Math.round(value));
                    valueChanger(val);

                    this.renderDistance = val;
                }
                simChanged = () => {
                    let simVal = Math.round(simulationDistance.value) - 2;
                    let val = Math.min(simVal,Math.round(renderDistance.value));
                    valueChanger(val);

                    this.renderDistance = val;
                }
                renderDistance.construct();
            }))
        }

        onReady(callback: (simulationDistance: number, renderDistance: number) => void) {
            this.readyCallback = callback;
        }

        private makeOption(text: string, construct: (parent: HTMLDivElement, valueChanger: (value: any) => void) => void): HTMLDivElement {
            let option = document.createElement('div');
            option.classList.add("option");

            let titleBar = document.createElement('div');
            titleBar.classList.add("title-bar");
            option.appendChild(titleBar);

            let title = document.createElement('h3');
            title.classList.add("title");
            title.innerHTML = text;
            titleBar.appendChild(title);

            let value = document.createElement('div');
            value.classList.add("value");
            titleBar.appendChild(value);

            construct(option, (val) => {
                value.innerHTML = val;
            })

            return option;
        }
    }

    class Slider {
        private parent: HTMLDivElement;

        private holder: HTMLDivElement;
        private line: HTMLDivElement;
        private handle: HTMLDivElement;
        private minText: HTMLSpanElement;
        private maxText: HTMLSpanElement;

        private min: number;
        private max: number;
        public value: number;

        public listener: (value: number) => void;

        constructor(parent: HTMLDivElement, min: number, max: number, value: number) {
            this.parent = parent;
            this.min = min;
            this.max = max;
            this.value = value;
        }

        construct() {
            this.holder = document.createElement('div');
            this.holder.classList.add("slider-holder");

            this.minText = document.createElement('span');
            this.minText.classList.add("min");
            this.minText.innerHTML = this.min + "";
            this.holder.appendChild(this.minText);

            let wrapper = document.createElement('div');
            wrapper.classList.add("slider-wrapper");
            {
                this.line = document.createElement('div');
                this.line.classList.add("slider-line");
                wrapper.appendChild(this.line);

                this.handle = document.createElement('div');
                this.handle.classList.add("slider-handle");
                this.handle.tabIndex = 1;

                wrapper.appendChild(this.handle);
            }

            document.body.addEventListener('mousemove', (e) => {
                if (document.activeElement == this.handle) {
                    let rect = this.line.getBoundingClientRect();
                    let rx = Math.min(Math.max(0, e.clientX - rect.left - (this.handle.offsetWidth / 2)), rect.width - this.handle.offsetWidth);
                    this.handle.style.left = rx + "px";

                    this.value = MathUtilities.Utils.scaleBetween(rx / (rect.width - this.handle.offsetWidth),this.min,this.max,0,1);
                    this.listener(this.value);
                }
            })
            document.body.addEventListener('mouseup', (e) => {
                if (document.activeElement == this.handle) {
                    this.handle.blur();
                }
            })

            this.holder.appendChild(wrapper);

            this.maxText = document.createElement('span');
            this.maxText.classList.add("max");
            this.maxText.innerHTML = this.max + "";
            this.holder.appendChild(this.maxText);

            this.parent.appendChild(this.holder);

            this.setValue(this.value);
            setTimeout(() => {
                this.setValue(this.value);
            },1000)
        }

        public setValue(value: number) {
            this.value = Math.min(this.max,Math.max(this.min,value));
            let rect = this.line.getBoundingClientRect();
            let left = MathUtilities.Utils.scaleBetween(this.value,0,rect.width - this.handle.offsetWidth,this.min,this.max);
            this.handle.style.left = left + "px";
            this.listener(this.value);
        }

        public setMin(min: number) {
            this.min = min;
            this.minText.innerHTML = this.min + "";
            this.setValue(this.value);
        }
        public setMax(min: number) {
            this.max = min;
            this.maxText.innerHTML = this.min + "";
            this.setValue(this.value);
        }
    }
}