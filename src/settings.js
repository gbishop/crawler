const key = "base-config";
const version = 1;
console.log(document.querySelector('#delay').value);
class Settings {
  constructor() {
    this.mode = "auto";
    this.sound = true;
    this.delay = document.querySelector('#delay').value ? Number(document.querySelector('#delay').value) : 300;
  }

  persist() {
    const data = {
      version: version,
      mode: this.mode,
      sound: this.sound,
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
