using System;

namespace Sdt.Res
{
    [Serializable] public sealed class UnitFrameAction
    {
        public string name;
        public string[] frames;
        public float[] milliseconds;
        public bool loop, hold;
    }
    [Serializable] public sealed class UnitFrameCatalog
    {
        public string id, neutral, catalogSha256, contactFrame;
        public int width, height;
        public float bodyHeight, bodyFill;
        public float[] neutralBounds;
        public UnitFrameAction[] actions;
        public float FigureHeight => bodyHeight / bodyFill;
        public float ActorHeight => FigureHeight * (neutralBounds[3] - neutralBounds[1]) / height;
        public float FootInset => FigureHeight * (height - neutralBounds[3]) / height;
        public UnitFrameAction Find(string name)
        {
            foreach (var action in actions) if (action.name == name) return action;
            return null;
        }
    }
}
