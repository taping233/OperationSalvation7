#nullable disable // vendored from inkle/ink ink-engine-runtime 1.2.1 (master@35c63e52f1d36060930dc7ed3cfba38ea224b528), MIT - see INKLE_INK_LICENSE.txt

﻿namespace Ink.Runtime
{
    /// <summary>
    /// Exception that represents an error when running a Story at runtime.
    /// An exception being thrown of this type is typically when there's
    /// a bug in your ink, rather than in the ink engine itself!
    /// </summary>
    public class StoryException : System.Exception
    {
        public bool useEndLineNumber;

        /// <summary>
        /// Constructs a default instance of a StoryException without a message.
        /// </summary>
        public StoryException () { }

        /// <summary>
        /// Constructs an instance of a StoryException with a message.
        /// </summary>
        /// <param name="message">The error message.</param>
        public StoryException(string message) : base(message) {}
    }
}

