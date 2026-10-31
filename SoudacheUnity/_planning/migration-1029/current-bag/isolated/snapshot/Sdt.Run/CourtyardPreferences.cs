using System;
using Newtonsoft.Json.Linq;

namespace Sdt.Run
{
    public sealed class CourtyardPreferences
    {
        public bool rain = true, sound;
        public int intensity = 40;
        public string palette = "slate";
        public static CourtyardPreferences Read(SaveSystem saves)
        {
            var value = saves.Global.GetJson("sdt-courtyard") as JObject;
            if (value == null) return new CourtyardPreferences();
            var palette = (string)value["palette"];
            return new CourtyardPreferences { rain = (bool?)value["rain"] ?? true, sound = (bool?)value["sound"] ?? false,
                intensity = (int?)value["intensity"] == 80 ? 80 : 40, palette = palette == "moss" || palette == "clay" ? palette : "slate" };
        }
        public bool Save(SaveSystem saves, out string error)
        {
            try { saves.Global.SetJson("sdt-courtyard", this); error = null; return true; }
            catch (Exception exception) { error = exception.Message; return false; }
        }
    }
}
