const key = "base-config";
const version = 1;

class Settings {
  constructor() {
    this.mode = "auto";
    this.sound = true;
    this.speed = 300;
    this.dictation = false;
  }

  persist() {
    const data = {
      version: version,
      mode: this.mode,
      sound: this.sound,
      speed: this.speed,
      dictation: this.dictation
    };
    const json = JSON.stringify(data);
    localStorage.setItem(key, json);
  }

  restore() {
    const json = localStorage.getItem(key);
    if (json) {
      const data = JSON.parse(json);
      if (data.version == version) {
        this.mode = data.mode;
        this.sound = data.sound;
        this.speed = data.speed;
        this.dictation = data.dictation;
      }
    }
  }
}

const settings = new Settings();
settings.restore();

export default settings;
