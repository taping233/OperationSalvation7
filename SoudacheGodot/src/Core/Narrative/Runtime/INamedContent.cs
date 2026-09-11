#nullable disable // vendored from inkle/ink ink-engine-runtime 1.2.1 (master@35c63e52f1d36060930dc7ed3cfba38ea224b528), MIT - see INKLE_INK_LICENSE.txt

﻿
namespace Ink.Runtime
{
	public interface INamedContent
	{
		string name { get; }
		bool hasValidName { get; }
	}
}

