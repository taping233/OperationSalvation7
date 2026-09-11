#nullable disable // vendored from inkle/ink ink-engine-runtime 1.2.1 (master@35c63e52f1d36060930dc7ed3cfba38ea224b528), MIT - see INKLE_INK_LICENSE.txt

﻿using System;
using System.Collections.Generic;
using System.Text;

namespace Ink.Runtime
{
    public static class StringExt
    {
        public static string Join<T>(string separator, List<T> objects)
        {
            var sb = new StringBuilder ();

            var isFirst = true;
            foreach (var o in objects) {

                if (!isFirst)
                    sb.Append (separator);

                sb.Append (o.ToString ());

                isFirst = false;
            }

            return sb.ToString ();
        }
    }
}

