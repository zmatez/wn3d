import {App} from "./main";
import {UI} from "./UI";
import StartMenu = UI.StartMenu;

let menu = new StartMenu();
menu.onReady((simulationDistance,renderDistance) => {
    let app = new App(simulationDistance,renderDistance);
    app.load();
})
menu.construct()