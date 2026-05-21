class NeewerLightFX {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.iconName = '';
        this.needBrr = false;
        this.needBrrUpperBound = false;
        this.needHue = false;
        this.needHueUpperBound = false;
        this.needSat = false;
        this.needCct = false;
        this.needCctUpperBound = false;
        this.needGm = false;
        this.needColor = false;
        this.needSpeed = false;
        this.needSparks = false;
        this.colors = [];
        this.sparkLevel = [];
        this.speedLevel = 10;
        this.brrValue = 100;
        this.brrUpperValue = 100;
        this.hueValue = 0;
        this.hueUpperValue = 360;
        this.satValue = 100;
        this.cctValue = 56;
        this.cctUpperValue = 56;
        this.gmValue = 0;
        this.colorValue = 0;
        this.sparksValue = 5;
        this.speedValue = 5;
    }

    // Static factory methods for each scene
    static lightingScene() {
        const scene = new NeewerLightFX(0x01, "Lighting");
        scene.iconName = "bolt.fill";
        scene.needBrr = true;
        scene.needCct = true;
        scene.needSpeed = true;
        scene.speedLevel = 10;
        return scene;
    }

    static paparazziScene() {
        const scene = new NeewerLightFX(0x02, "Paparazzi");
        scene.iconName = "camera.shutter.button";
        scene.needBrr = true;
        scene.needCct = true;
        scene.needGm = true;
        scene.needSpeed = true;
        scene.speedLevel = 10;
        return scene;
    }

    static defectiveBulbScene() {
        const scene = new NeewerLightFX(0x03, "Defective bulb");
        scene.iconName = "lightbulb.min.badge.exclamationmark.fill";
        scene.needBrr = true;
        scene.needCct = true;
        scene.needGm = true;
        scene.needSpeed = true;
        scene.speedLevel = 10;
        return scene;
    }

    static explosionScene() {
        const scene = new NeewerLightFX(0x04, "Explosion");
        scene.iconName = "timelapse";
        scene.needBrr = true;
        scene.needCct = true;
        scene.needGm = true;
        scene.needSpeed = true;
        scene.speedLevel = 10;
        scene.needSparks = true;
        scene.sparkLevel = [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A];
        return scene;
    }

    static weldingScene() {
        const scene = new NeewerLightFX(0x05, "Welding");
        scene.needBrr = true;
        scene.needBrrUpperBound = true;
        scene.needCct = true;
        scene.needGm = true;
        scene.needSpeed = true;
        scene.speedLevel = 10;
        return scene;
    }

    static cctFlashScene() {
        const scene = new NeewerLightFX(0x06, "CCT flash");
        scene.needBrr = true;
        scene.needCct = true;
        scene.needGm = true;
        scene.needSpeed = true;
        scene.speedLevel = 10;
        return scene;
    }

    static hueFlashScene() {
        const scene = new NeewerLightFX(0x07, "HUE flash");
        scene.needBrr = true;
        scene.needHue = true;
        scene.needSat = true;
        scene.needSpeed = true;
        scene.speedLevel = 10;
        return scene;
    }

    static cctPulseScene() {
        const scene = new NeewerLightFX(0x08, "CCT pulse");
        scene.needBrr = true;
        scene.needCct = true;
        scene.needGm = true;
        scene.needSpeed = true;
        scene.speedLevel = 10;
        return scene;
    }

    static huePulseScene() {
        const scene = new NeewerLightFX(0x09, "HUE pulse");
        scene.needBrr = true;
        scene.needHue = true;
        scene.needSat = true;
        scene.needSpeed = true;
        scene.speedLevel = 10;
        return scene;
    }

    static copCarScene() {
        const scene = new NeewerLightFX(0x0A, "Cop Car");
        scene.needBrr = true;
        scene.needColor = true;
        scene.colors = [
            { key: "Red", value: 0x00 },
            { key: "Red and Blue", value: 0x02 },
            { key: "Blue", value: 0x01 },
            { key: "White and Blue", value: 0x03 },
            { key: "Red blue white", value: 0x04 }
        ];
        scene.needSpeed = true;
        scene.speedLevel = 10;
        scene.name = "Cop Car";
        return scene;
    }

    static candlelightScene() {
        const scene = new NeewerLightFX(0x0B, "Candlelight");
        scene.needBrr = true;
        scene.needBrrUpperBound = true;
        scene.needCct = true;
        scene.needGm = true;
        scene.needSpeed = true;
        scene.speedLevel = 10;
        scene.needSparks = true;
        scene.sparkLevel = [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A];
        return scene;
    }

    static hueLoopScene() {
        const scene = new NeewerLightFX(0x0C, "HUE Loop");
        scene.needBrr = true;
        scene.needHue = true;
        scene.needHueUpperBound = true;
        scene.needSpeed = true;
        scene.speedLevel = 10;
        return scene;
    }

    static cctLoopScene() {
        const scene = new NeewerLightFX(0x0D, "CCT Loop");
        scene.needBrr = true;
        scene.needCct = true;
        scene.needCctUpperBound = true;
        scene.needSpeed = true;
        scene.speedLevel = 10;
        return scene;
    }

    static intLoopScene() {
        const scene = new NeewerLightFX(0x0E, "INT loop");
        scene.needBrr = true;
        scene.needBrrUpperBound = true;
        scene.needHue = true;
        scene.needSpeed = true;
        scene.speedLevel = 10;
        return scene;
    }

    static tvScreenScene() {
        const scene = new NeewerLightFX(0x0F, "TV Screen");
        scene.iconName = "tv";
        scene.needBrr = true;
        scene.needCct = true;
        scene.needGm = true;
        scene.needSpeed = true;
        scene.speedLevel = 10;
        return scene;
    }

    static fireworkScene() {
        const scene = new NeewerLightFX(0x10, "Firework");
        scene.iconName = "fireworks";
        scene.needBrr = true;
        scene.needSpeed = true;
        scene.speedLevel = 10;
        scene.needColor = true;
        scene.colors = [
            { key: "Single color", value: 0x00 },
            { key: "Color", value: 0x01 },
            { key: "Combined", value: 0x02 }
        ];
        scene.needSparks = true;
        scene.sparkLevel = [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A];
        return scene;
    }

    static partyScene() {
        const scene = new NeewerLightFX(0x11, "Party");
        scene.iconName = "party.popper.fill";
        scene.needBrr = true;
        scene.needSpeed = true;
        scene.speedLevel = 10;
        scene.needColor = true;
        scene.colors = [
            { key: "Single color", value: 0x00 },
            { key: "Color", value: 0x01 },
            { key: "Combined", value: 0x02 }
        ];
        return scene;
    }
}

module.exports = NeewerLightFX; 