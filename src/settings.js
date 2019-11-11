const key = "base-config";
const version = 1;

class Settings {
  constructor() {
    this.mode = "auto";
    this.sound = true;
  }

  persist() {
    const data = {
      version: version,
      mode: this.mode,
      sound: this.sound
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
      }
    }
  }
}

const settings = new Settings();
settings.restore();

export default settings;
