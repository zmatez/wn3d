export namespace UI{
    export class GUI{
        public static ASSETS: string = "assets/";

        public element: HTMLDivElement;
        public debug: HTMLDivElement;
        public pointer: HTMLDivElement;
        public stats: HTMLDivElement;

        constructor() {
            this.element = <HTMLDivElement>document.getElementsByClassName('gui')[0];
        }

        create(){
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

        setDebugText(text: string){
            this.debug.innerHTML = text;
        }
    }
}