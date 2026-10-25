# 参考模组代码摘录

每段保留原文件行号。摘录用于定位与理解；反编译片段不是可直接粘贴进 Vite 的实现。项目片段取自本轮冻结副本。

## R01

状态入口、悬停、展开的独立进度

原文件：`P3Makoto.Scenes/StatusButton.cs`；原行：129–191、305–363。

```text
--- P3Makoto.Scenes/StatusButton.cs:129 ---
  129 | 			Name = StringName.op_Implicit("P3StatusButton"),
  130 | 			Size = new Vector2(82f, 28f),
  131 | 			MouseFilter = (MouseFilterEnum)0,
  132 | 			MouseDefaultCursorShape = (CursorShape)2,
  133 | 			Visible = false,
  134 | 			PivotOffset = new Vector2(41f, 14f)
  135 | 		};
  136 | 		((Node)nodeOrNull).AddChild((Node)(object)b.Hit, false, (InternalMode)0);
  137 | 		b.Deco = new Node2D();
  138 | 		((Node)b.Hit).AddChild((Node)(object)b.Deco, false, (InternalMode)0);
  139 | 		Fx.Poly((Node)(object)b.Deco, Slab(4f, 78f, 4f, 32f), new Color(0f, 0f, 0.03f, 0.5f));
  140 | 		b.Normal = new Node2D();
  141 | 		((Node)b.Deco).AddChild((Node)(object)b.Normal, false, (InternalMode)0);
  142 | 		Fx.Poly((Node)(object)b.Normal, Slab(0f, 74f, 0f, 28f), Navy);
  143 | 		Fx.StrokeClosed((Node)(object)b.Normal, Slab(0f, 74f, 0f, 28f), new Color(1f, 1f, 1f, 0.35f), 1.4f, additive: false);
  144 | 		b.Open = new Node2D
  145 | 		{
  146 | 			Modulate = new Color(1f, 1f, 1f, 0f)
  147 | 		};
  148 | 		((Node)b.Deco).AddChild((Node)(object)b.Open, false, (InternalMode)0);
  149 | 		Fx.StrokeClosed((Node)(object)b.Open, Slab(5f, 79f, -5f, 23f), Red, 2f, additive: false);
  150 | 		Fx.Poly((Node)(object)b.Open, Slab(0f, 74f, 0f, 28f), new Color(0.97f, 0.98f, 1f, 1f));
  151 | 		Fx.Poly((Node)(object)b.Deco, (Vector2[])(object)new Vector2[4]
  152 | 		{
  153 | 			new Vector2(8f, 0f),
  154 | 			new Vector2(15f, 0f),
  155 | 			new Vector2(7f, 28f),
  156 | 			new Vector2(0f, 28f)
  157 | 		}, Cyan);
  158 | 		for (int i = 0; i < 3; i++)
  159 | 		{
  160 | 			float num = 8f + (float)i * 6f;
  161 | 			float num2 = ((i == 1) ? 12f : 16f);
  162 | 			((Node)Fx.Stroke((Node)(object)b.Deco, (Vector2[])(object)new Vector2[2]
  163 | 			{
  164 | 				new Vector2(17f + (float)(2 - i) * 1.5f, num),
  165 | 				new Vector2(17f + (float)(2 - i) * 1.5f + num2, num)
  166 | 			}, Colors.White, 2.4f, additive: false)).Name = StringName.op_Implicit("Icon");
  167 | 		}
  168 | 		b.Count = Typo.Text((Node)(object)b.Deco, "×0", Typo.Barlow, 24, Cyan, new Vector2(38f, -1f), (HorizontalAlignment)0, 4, Ink);
  169 | 		b.Hit.MouseEntered += (Action)delegate
  170 | 		{
  171 | 			b.Mouse = true;
  172 | 		};
  173 | 		b.Hit.MouseExited += (Action)delegate
  174 | 		{
  175 | 			b.Mouse = false;
  176 | 		};
  177 | 		b.Hit.GuiInput += (GuiInputEventHandler)delegate(InputEvent ev)
  178 | 		{
  181 | 			ModEntry.Safe("status button", (Action)delegate
  182 | 			{
  185 | 				InputEvent obj = ev;
  186 | 				InputEventMouseButton val = (InputEventMouseButton)(object)((obj is InputEventMouseButton) ? obj : null);
  187 | 				if (val != null && val.Pressed && (long)val.ButtonIndex == 1)
  188 | 				{
  189 | 					b.Hit.AcceptEvent();
  190 | 					b.Pulse = 1f;
  191 | 					TipList.Toggle(creature);
--- P3Makoto.Scenes/StatusButton.cs:305 ---
  305 | 		float num = (float)Time.GetTicksMsec() / 1000f;
  306 | 		if (num >= b.NextCount)
  307 | 		{
  308 | 			b.NextCount = num + 0.25f;
  309 | 			int num2 = ((!creature.Entity.IsDead) ? TipList.TextTips(creature).Count : 0);
  310 | 			if (num2 != b.Shown)
  311 | 			{
  312 | 				b.Shown = num2;
  313 | 				b.Count.Text = "×" + num2;
  314 | 			}
  315 | 		}
  316 | 		bool flag = b.Shown > 0 && TipList.CanShow(creature) && ((CanvasItem)bar).IsVisibleInTree();
  317 | 		((CanvasItem)b.Hit).Visible = flag;
  318 | 		if (!flag)
  319 | 		{
  320 | 			if (TipList.IsOpen(creature))
  321 | 			{
  322 | 				TipList.Close(creature);
  323 | 			}
  324 | 			return;
  325 | 		}
  326 | 		Rect2 globalRect = bar.GetGlobalRect();
  327 | 		Transform2D globalTransform = ((CanvasItem)((Node)b.Hit).GetParent<Control>()).GetGlobalTransform();
  328 | 		Vector2 scale = ((Transform2D)(ref globalTransform)).Scale;
  329 | 		Vector2 val = ((Vector2)(ref scale)).Abs();
  330 | 		Vector2 globalPosition = default(Vector2);
  331 | 		((Vector2)(ref globalPosition))._002Ector(((Rect2)(ref globalRect)).End.X + 24f * val.X, ((Rect2)(ref globalRect)).GetCenter().Y - 28f * val.Y / 2f);
  332 | 		b.Hit.GlobalPosition = globalPosition;
  333 | 		bool flag2 = TipList.IsOpen(creature);
  334 | 		b.Hover = Mathf.MoveToward(b.Hover, b.Mouse ? 1f : 0f, dt / 0.12f);
  335 | 		b.OpenK = Mathf.MoveToward(b.OpenK, flag2 ? 1f : 0f, dt / 0.15f);
  336 | 		b.Pulse = Mathf.Max(0f, b.Pulse - dt * 2.5f);
  337 | 		float num3 = Ease.OutCubic(b.Hover);
  338 | 		float num4 = Ease.OutCubic(b.OpenK);
  339 | 		b.Hit.Scale = Vector2.One * (1f + 0.08f * num3 + 0.12f * Mathf.Sin((float)Math.PI * Mathf.Min(1f, b.Pulse)) * b.Pulse);
  340 | 		((CanvasItem)b.Open).Modulate = new Color(1f, 1f, 1f, num4);
  341 | 		float num5 = 1f + 0.18f * num3;
  342 | 		((CanvasItem)b.Normal).Modulate = new Color(num5, num5, num5, 1f);
  343 | 		Color white = Colors.White;
  344 | 		Color color = ((Color)(ref white)).Lerp(Ink, num4);
  345 | 		global::System.Collections.Generic.IEnumerator<Node> enumerator = ((Node)b.Deco).GetChildren(false).GetEnumerator();
  346 | 		try
  347 | 		{
  348 | 			while (((global::System.Collections.IEnumerator)enumerator).MoveNext())
  349 | 			{
  350 | 				Node current = enumerator.Current;
  351 | 				Polygon2D val2 = (Polygon2D)(object)((current is Polygon2D) ? current : null);
  352 | 				if (val2 != null && ((Node)val2).Name == StringName.op_Implicit("Icon"))
  353 | 				{
  354 | 					val2.Color = color;
  355 | 				}
  356 | 			}
  357 | 		}
  358 | 		finally
  359 | 		{
  360 | 			((global::System.IDisposable)enumerator)?.Dispose();
  361 | 		}
  362 | 		b.Count.LabelSettings.FontColor = ((Color)(ref Cyan)).Lerp(Ink, num4);
  363 | 		b.Count.LabelSettings.OutlineColor = ((Color)(ref Ink)).Lerp(new Color(1f, 1f, 1f, 0f), num4);
```

## R02

状态列表数据来源与打开/关闭输入

原文件：`P3Makoto.Scenes/TipList.cs`；原行：129–136、221–231、271–325、412–421。

```text
--- P3Makoto.Scenes/TipList.cs:129 ---
  129 | 	internal static List<HoverTip> TextTips(NCreature creature)
  130 | 	{
  131 | 		return Enumerable.ToList<HoverTip>(Enumerable.OfType<HoverTip>((global::System.Collections.IEnumerable)IHoverTip.RemoveDupes(creature.Entity.HoverTips)));
  132 | 	}
  133 | 
  134 | 	private static string Sig(List<HoverTip> text)
  135 | 	{
  136 | 		return string.Join("\u0002", Enumerable.Select<HoverTip, string>((global::System.Collections.Generic.IEnumerable<HoverTip>)text, (Func<HoverTip, string>)((HoverTip t) => (((HoverTip)(ref t)).IsDebuff ? "-" : "+") + ((HoverTip)(ref t)).Title + "\u0001" + ((HoverTip)(ref t)).Description)));
--- P3Makoto.Scenes/TipList.cs:221 ---
  221 | 		ulong id = ((GodotObject)creature).GetInstanceId();
  222 | 		State state = default(State);
  223 | 		if (Lists.TryGetValue(id, ref state) && state.CloseT0 < 0f)
  224 | 		{
  225 | 			Close(id);
  226 | 			return;
  227 | 		}
  228 | 		if (state != null)
  229 | 		{
  230 | 			Free(id, state);
  231 | 		}
--- P3Makoto.Scenes/TipList.cs:271 ---
  271 | 		st.Dismiss = new Control
  272 | 		{
  273 | 			Name = StringName.op_Implicit("Dismiss"),
  274 | 			MouseFilter = (MouseFilterEnum)0
  275 | 		};
  276 | 		((Node)st.Root).AddChild((Node)(object)st.Dismiss, false, (InternalMode)0);
  277 | 		st.Dismiss.GuiInput += (GuiInputEventHandler)delegate(InputEvent ev)
  278 | 		{
  281 | 			st.Dismiss.AcceptEvent();
  282 | 			InputEventMouseButton val3 = (InputEventMouseButton)(object)((ev is InputEventMouseButton) ? ev : null);
  283 | 			if (val3 != null && val3.Pressed && (long)val3.ButtonIndex == 1)
  284 | 			{
  285 | 				Close(id);
  286 | 			}
  287 | 		};
  288 | 		st.Catcher = new Control
  289 | 		{
  290 | 			MouseFilter = (MouseFilterEnum)0
  291 | 		};
  292 | 		((Node)st.Root).AddChild((Node)(object)st.Catcher, false, (InternalMode)0);
  293 | 		st.Catcher.GuiInput += (GuiInputEventHandler)delegate(InputEvent ev)
  294 | 		{
  297 | 			ModEntry.Safe("tip list wheel", (Action)delegate
  298 | 			{
  304 | 				if (ev is InputEventMouseMotion)
  305 | 				{
  306 | 					st.Mouse = ((CanvasItem)st.Catcher).GetGlobalMousePosition();
  307 | 					st.MouseIn = true;
  308 | 				}
  309 | 				InputEvent obj = ev;
  310 | 				InputEventMouseButton val3 = (InputEventMouseButton)(object)((obj is InputEventMouseButton) ? obj : null);
  311 | 				if (val3 != null && val3.Pressed && (long)val3.ButtonIndex == 1 && StatusButton.Contains(creature, ((CanvasItem)st.Catcher).GetGlobalMousePosition()))
  312 | 				{
  313 | 					st.Catcher.AcceptEvent();
  314 | 					Close(id);
  315 | 				}
  316 | 				else
  317 | 				{
  318 | 					Wheel(creature, ev);
  319 | 				}
  320 | 			});
  321 | 		};
  322 | 		st.Catcher.MouseExited += (Action)delegate
  323 | 		{
  324 | 			st.MouseIn = false;
  325 | 		};
--- P3Makoto.Scenes/TipList.cs:412 ---
  412 | 	private static void Close(ulong id)
  413 | 	{
  414 | 		State state = default(State);
  415 | 		if (Lists.TryGetValue(id, ref state) && state.CloseT0 < 0f)
  416 | 		{
  417 | 			state.CloseT0 = Now;
  418 | 			if (GodotObject.IsInstanceValid((GodotObject)(object)state.Catcher))
  419 | 			{
  420 | 				state.Catcher.MouseFilter = (MouseFilterEnum)2;
  421 | 			}
```

## R03

列表空间预算、滚动、单条强调与错峰

原文件：`P3Makoto.Scenes/TipList.cs`；原行：363–376、1073–1160、1204–1209。

```text
--- P3Makoto.Scenes/TipList.cs:363 ---
  363 | 				float num = Mathf.Clamp(state.WindowH * 0.22f, 70f, 140f);
  364 | 				if ((long)val.ButtonIndex == 4)
  365 | 				{
  366 | 					state.Target -= num;
  367 | 				}
  368 | 				else
  369 | 				{
  370 | 					if ((long)val.ButtonIndex != 5)
  371 | 					{
  372 | 						return false;
  373 | 					}
  374 | 					state.Target += num;
  375 | 				}
  376 | 				state.Target = Mathf.Clamp(state.Target, 0f, state.ContentH - state.WindowH);
--- P3Makoto.Scenes/TipList.cs:1073 ---
 1073 | 				num += size2.Y + 18f;
 1074 | 			}
 1075 | 		}
 1076 | 		finally
 1077 | 		{
 1078 | 			((global::System.IDisposable)enumerator/*cast due to .constrained prefix*/).Dispose();
 1079 | 		}
 1080 | 		st.ContentH = Mathf.Max(0f, num - 18f);
 1081 | 		st.WindowH = Mathf.Min(st.ContentH, size.Y * 0.62f);
 1082 | 		bool flag = st.ContentH > st.WindowH + 1f;
 1083 | 		st.Target = Mathf.Clamp(st.Target, 0f, Mathf.Max(0f, st.ContentH - st.WindowH));
 1084 | 		st.Scroll = Mathf.Lerp(st.Scroll, st.Target, 1f - Mathf.Exp(-14f * dt));
 1085 | 		Rect2 globalRect = st.Owner.GetGlobalRect();
 1086 | 		float num3 = 34f;
 1087 | 		float num4 = 64f * Mathf.Clamp((float)(st.Rows.Count - 1) / 4f, 0f, 1f);
 1088 | 		float num5 = (st.Right ? (((Rect2)(ref globalRect)).End.X + num3) : (((Rect2)(ref globalRect)).Position.X - num3 - num2));
 1089 | 		float num6 = Mathf.Clamp(((Rect2)(ref globalRect)).GetCenter().Y - 30f, st.WindowH / 2f + 120f, size.Y - st.WindowH / 2f - 40f) - st.WindowH / 2f;
 1090 | 		float num7 = Mathf.Max(st.WindowH / 2f, 1f);
 1091 | 		float num8 = ((st.CloseT0 >= 0f) ? Mathf.Clamp((now - st.CloseT0) / 0.14f, 0f, 1f) : 0f);
 1092 | 		float num9 = (st.Right ? 1f : (-1f));
 1093 | 		int num10 = -1;
 1094 | 		float num11 = 3.4028235E+38f;
 1095 | 		for (int i = 0; i < st.Rows.Count; i++)
 1096 | 		{
 1097 | 			Row row = st.Rows[i];
 1098 | 			if (st.MouseIn && ((CanvasItem)row.Node).Visible)
 1099 | 			{
 1100 | 				val = row.Node.GetGlobalRect();
 1101 | 				val = ((Rect2)(ref val)).Grow(10f);
 1102 | 				if (((Rect2)(ref val)).HasPoint(st.Mouse))
 1103 | 				{
 1104 | 					num10 = i;
 1105 | 					break;
 1106 | 				}
 1107 | 			}
 1108 | 			float num12 = Mathf.Abs(row.Y + row.H / 2f - st.Scroll - num7);
 1109 | 			if (flag && !st.MouseIn && num12 < num11)
 1110 | 			{
 1111 | 				num11 = num12;
 1112 | 				num10 = i;
 1113 | 			}
 1114 | 		}
 1115 | 		float rotation = Mathf.Clamp((st.Target - st.Scroll) * 0.00045f, -0.05f, 0.05f) * num9;
 1116 | 		for (int j = 0; j < st.Rows.Count; j++)
 1117 | 		{
 1118 | 			Row row2 = st.Rows[j];
 1119 | 			row2.Node.Size = new Vector2(row2.W, row2.H);
 1120 | 			bool flag2 = j == num10 && num8 <= 0f;
 1121 | 			if (flag2 && row2.SelK <= 0.01f)
 1122 | 			{
 1123 | 				row2.ShineT = now;
 1124 | 				Sfx.Clip("Sys_Cursor", 0.18f);
 1125 | 			}
 1126 | 			row2.SelK = Mathf.MoveToward(row2.SelK, flag2 ? 1f : 0f, dt / 0.12f);
 1127 | 			float num13 = Ease.OutCubic(row2.SelK);
 1128 | 			if (row2.Sel != null)
 1129 | 			{
 1130 | 				((CanvasItem)row2.Sel).Modulate = new Color(1f, 1f, 1f, num13);
 1131 | 			}
 1132 | 			if (row2.Pointer != null)
 1133 | 			{
 1134 | 				((CanvasItem)row2.Pointer).Modulate = new Color(1f, 1f, 1f, num13);
 1135 | 				row2.Pointer.Position = new Vector2(row2.Pointer.Position.X, row2.H / 2f + Mathf.Sin(now * 6f) * 1.5f);
 1136 | 			}
 1137 | 			if (row2.Shine != null)
 1138 | 			{
 1139 | 				float num14 = ((row2.ShineT >= 0f) ? ((now - row2.ShineT) / 0.45f) : 2f);
 1140 | 				((CanvasItem)row2.Shine).Visible = num14 < 1f;
 1141 | 				if (num14 < 1f)
 1142 | 				{
 1143 | 					row2.Shine.Position = new Vector2(-30f + (row2.W + 60f) * Ease.InOutCubic(num14), 0f);
 1144 | 					((CanvasItem)row2.Shine).Modulate = new Color(1f, 1f, 1f, Mathf.Sin((float)Math.PI * num14));
 1145 | 				}
 1146 | 			}
 1147 | 			float num15 = row2.Y + row2.H / 2f - st.Scroll;
 1148 | 			float num16 = Mathf.Abs((num15 - num7) / num7);
 1149 | 			float num17 = (flag ? (1f - Mathf.SmoothStep(0.62f, 1.08f, num16)) : 1f);
 1150 | 			float num18 = (flag ? (1f - 0.08f * Mathf.SmoothStep(0.3f, 1f, num16)) : 1f);
 1151 | 			float num19 = num4 * (1f - Mathf.Min(num16 * num16, 1.6f));
 1152 | 			float num20 = Ease.OutCubic(Mathf.Clamp((now - st.T0 - (float)j * 0.035f) / 0.3f, 0f, 1f));
 1153 | 			num17 *= num20 * (1f - num8);
 1154 | 			float num21 = num5 + num9 * (num19 - 70f * (1f - num20) - 24f * num8 + 14f * num13);
 1155 | 			num18 *= 1f + 0.03f * num13;
 1156 | 			float num22 = (st.Right ? num21 : (num21 + (num2 - row2.W)));
 1157 | 			row2.Node.Position = new Vector2(num22, num6 + num15 - row2.H / 2f);
 1158 | 			row2.Node.PivotOffset = new Vector2(st.Right ? 0f : row2.W, row2.H / 2f);
 1159 | 			row2.Node.Scale = Vector2.One * num18;
 1160 | 			row2.Node.Rotation = rotation;
--- P3Makoto.Scenes/TipList.cs:1204 ---
 1204 | 			float num26 = st.WindowH - 40f;
 1205 | 			((Node2D)(Polygon2D)((Node)st.Track).GetChild(0, false)).Scale = new Vector2(1f, num26);
 1206 | 			float num27 = Mathf.Max(24f, num26 * st.WindowH / st.ContentH);
 1207 | 			float num28 = st.Scroll / Mathf.Max(1f, st.ContentH - st.WindowH);
 1208 | 			((Node2D)st.Thumb).Position = new Vector2(0f, (num26 - num27) * Mathf.Clamp(num28, 0f, 1f));
 1209 | 			((Node2D)st.Thumb).Scale = new Vector2(1f, num27);
```

## R04

原说明内容与正负状态表面

原文件：`P3Makoto.Scenes/TipList.cs`；原行：611–653、778–811。

```text
--- P3Makoto.Scenes/TipList.cs:611 ---
  611 | 				Control val3 = _scene.Instantiate<Control>((GenEditState)0);
  612 | 				((Node)val).AddChild((Node)(object)val3, false, (InternalMode)0);
  613 | 				val3.MouseFilter = (MouseFilterEnum)2;
  614 | 				global::System.Collections.Generic.IEnumerator<Node> enumerator3 = ((Node)val3).FindChildren("*", "Control", true, false).GetEnumerator();
  615 | 				try
  616 | 				{
  617 | 					while (((global::System.Collections.IEnumerator)enumerator3).MoveNext())
  618 | 					{
  619 | 						((Control)enumerator3.Current).MouseFilter = (MouseFilterEnum)2;
  620 | 					}
  621 | 				}
  622 | 				finally
  623 | 				{
  624 | 					((global::System.IDisposable)enumerator3)?.Dispose();
  625 | 				}
  626 | 				MegaLabel nodeOrNull = ((Node)val3).GetNodeOrNull<MegaLabel>(NodePath.op_Implicit("%Title"));
  627 | 				if (nodeOrNull != null)
  628 | 				{
  629 | 					if (((HoverTip)(ref current2)).Title == null)
  630 | 					{
  631 | 						((CanvasItem)nodeOrNull).Visible = false;
  632 | 					}
  633 | 					else
  634 | 					{
  635 | 						nodeOrNull.SetTextAutoSize(((HoverTip)(ref current2)).Title);
  636 | 						Typo.Restyle((Label)(object)nodeOrNull, Typo.CjkBold, (Color)(((HoverTip)(ref current2)).IsDebuff ? new Color(1f, 0.62f, 0.68f, 1f) : Colors.White), Ink, 4);
  637 | 					}
  638 | 				}
  639 | 				MegaRichTextLabel nodeOrNull2 = ((Node)val3).GetNodeOrNull<MegaRichTextLabel>(NodePath.op_Implicit("%Description"));
  640 | 				if (nodeOrNull2 != null)
  641 | 				{
  642 | 					nodeOrNull2.Text = ((HoverTip)(ref current2)).Description;
  643 | 					((RichTextLabel)nodeOrNull2).AutowrapMode = (AutowrapMode)(((HoverTip)(ref current2)).ShouldOverrideTextOverflow ? 0 : 3);
  644 | 				}
  645 | 				TextureRect nodeOrNull3 = ((Node)val3).GetNodeOrNull<TextureRect>(NodePath.op_Implicit("%Icon"));
  646 | 				if (nodeOrNull3 != null)
  647 | 				{
  648 | 					nodeOrNull3.Texture = ((HoverTip)(ref current2)).Icon;
  649 | 				}
  650 | 				CanvasItem nodeOrNull4 = ((Node)val3).GetNodeOrNull<CanvasItem>(NodePath.op_Implicit("%Bg"));
  651 | 				if (nodeOrNull4 != null)
  652 | 				{
  653 | 					nodeOrNull4.SelfModulate = new Color(1f, 1f, 1f, 0f);
--- P3Makoto.Scenes/TipList.cs:778 ---
  778 | 		float num = -16f;
  779 | 		float num2 = size.X + 14f;
  780 | 		float num3 = -6f;
  781 | 		float num4 = size.Y + 6f;
  782 | 		float lean = 12f;
  783 | 		Color color = (r.Debuff ? Wine : Navy);
  784 | 		Color color2 = (r.Debuff ? Red : Cyan);
  785 | 		Fx.Poly((Node)(object)r.Plate, Box(num + 8f, num2 + 8f, num3 + 8f, num4 + 8f), new Color(0f, 0f, 0.03f, 0.45f));
  786 | 		Fx.Poly((Node)(object)r.Plate, Box(num, num2, num3, num4), color);
  787 | 		Fx.Poly((Node)(object)r.Plate, (Vector2[])(object)new Vector2[4]
  788 | 		{
  789 | 			new Vector2(num + lean + 14f, num3 + 3f),
  790 | 			new Vector2(num2 + lean - 2f, num3 + 3f),
  791 | 			new Vector2(num2 + lean - 2.5f, num3 + 4.5f),
  792 | 			new Vector2(num + lean + 13.5f, num3 + 4.5f)
  793 | 		}, new Color(1f, 1f, 1f, 0.22f));
  794 | 		float num5 = 9f;
  795 | 		float num6 = lean / (num4 - num3);
  796 | 		Fx.Poly((Node)(object)r.Plate, (Vector2[])(object)new Vector2[4]
  797 | 		{
  798 | 			new Vector2(num + lean, num3),
  799 | 			new Vector2(num + lean + num5, num3),
  800 | 			new Vector2(num + num5, num4),
  801 | 			new Vector2(num, num4)
  802 | 		}, color2);
  803 | 		float num7 = num + (num2 - num) * 0.45f;
  804 | 		Fx.Poly((Node)(object)r.Plate, (Vector2[])(object)new Vector2[4]
  805 | 		{
  806 | 			new Vector2(num7 + num6 * 4f, num4 - 4f),
  807 | 			new Vector2(num2 + num6 * 4f, num4 - 4f),
  808 | 			new Vector2(num2, num4),
  809 | 			new Vector2(num7, num4)
  810 | 		}, Red);
  811 | 		Fx.StrokeClosed((Node)(object)r.Plate, Box(num, num2, num3, num4), new Color(1f, 1f, 1f, 0.28f), 1.5f, additive: false);
```

## R05

时间步长、内容签名、刷新和失效关闭

原文件：`P3Makoto.Scenes/TipList.cs`；原行：914–956。

```text
--- P3Makoto.Scenes/TipList.cs:914 ---
  914 | 			float dt = Mathf.Min((float)(ticksUsec - last) / 1000000f, 0.1f);
  915 | 			last = ticksUsec;
  916 | 			try
  917 | 			{
  918 | 				if (!GodotObject.IsInstanceValid((GodotObject)(object)st.Root) || !GodotObject.IsInstanceValid((GodotObject)(object)st.Owner) || !GodotObject.IsInstanceValid((GodotObject)(object)st.Creature))
  919 | 				{
  920 | 					Free(id, st);
  921 | 				}
  922 | 				else if (!CanShow(st.Creature))
  923 | 				{
  924 | 					Free(id, st);
  925 | 				}
  926 | 				else
  927 | 				{
  928 | 					if (st.CloseT0 < 0f && Now >= st.NextRefresh)
  929 | 					{
  930 | 						st.NextRefresh = Now + 0.25f;
  931 | 						List<HoverTip> val2 = TextTips(st.Creature);
  932 | 						string text = Sig(val2);
  933 | 						if (val2.Count == 0)
  934 | 						{
  935 | 							Close(id);
  936 | 						}
  937 | 						else if (text != st.Sig)
  938 | 						{
  939 | 							st.Sig = text;
  940 | 							Fill(st, val2);
  941 | 							Enumerator<Row> enumerator = st.Rows.GetEnumerator();
  942 | 							try
  943 | 							{
  944 | 								while (enumerator.MoveNext())
  945 | 								{
  946 | 									((CanvasItem)enumerator.Current.Node).Modulate = Colors.White;
  947 | 								}
  948 | 							}
  949 | 							finally
  950 | 							{
  951 | 								((global::System.IDisposable)enumerator/*cast due to .constrained prefix*/).Dispose();
  952 | 							}
  953 | 						}
  954 | 					}
  955 | 					Layout(st, dt);
  956 | 					if (st.CloseT0 >= 0f && Now - st.CloseT0 > 0.15f)
```

## R06

卡片连续进度、占位、前置、明暗与名称条

原文件：`P3Makoto.Vfx/PileFx.cs`；原行：1837–1910、1954–1998、2045–2051、2077–2117。

```text
--- P3Makoto.Vfx/PileFx.cs:1837 ---
 1837 | 					float num4 = Now();
 1838 | 					float num5 = Mathf.Clamp(num4 - lastNow, 0f, 0.1f);
 1839 | 					lastNow = num4;
 1840 | 					focusP = Mathf.MoveToward(focusP, focusOn ? 1f : 0f, num5 / (focusOn ? 0.5f : 0.42f));
 1841 | 					if (focused != null && !focusOn && focusP <= 0f)
 1842 | 					{
 1843 | 						BindBack(on: false);
 1844 | 						upBtn.Hide();
 1845 | 						focused = null;
 1846 | 						((CanvasItem)catcher).Visible = false;
 1847 | 						FreeFlip(flip);
 1848 | 						flip = null;
 1849 | 					}
 1850 | 					float num6 = Ease.InOutCubic(focusP);
 1851 | 					val11 = focusAt * k;
 1852 | 					Animate(fx, num6, focusP, focusOn, num4, val11, k);
 1853 | 					float num7 = (exiting ? Mathf.Clamp((num4 - exitT0) / 0.42f, 0f, 1f) : 0f);
 1854 | 					butterfly.Update(num4, num5);
 1855 | 					if (exiting)
 1856 | 					{
 1857 | 						float num8 = Ease.InCubic(num7);
 1858 | 						right.Position = new Vector2(820f * k * L.Side * num8, 0f);
 1859 | 						((CanvasItem)right).Modulate = new Color(1f, 1f, 1f, 1f - Ease.InCubic(Mathf.Clamp((num7 - 0.3f) / 0.7f, 0f, 1f)));
 1860 | 						water.SetShaderParameter(StringName.op_Implicit("radius"), Variant.op_Implicit(diag * (1f - Ease.InOutCubic(Mathf.Clamp((num7 - 0.15f) / 0.85f, 0f, 1f)))));
 1861 | 						((CanvasItem)bubbles).Modulate = new Color(1f, 1f, 1f, 1f - num7);
 1862 | 						CanvasItem nodeOrNull2 = ((Node)screen).GetNodeOrNull<CanvasItem>(NodePath.op_Implicit("BackButton"));
 1863 | 						if (nodeOrNull2 != null)
 1864 | 						{
 1865 | 							nodeOrNull2.Modulate = new Color(1f, 1f, 1f, 1f - Ease.OutCubic(num7));
 1866 | 						}
 1867 | 						((CanvasItem)fx.Layer).Modulate = new Color(1f, 1f, 1f, 1f - num7);
 1868 | 						if (flip != null)
 1869 | 						{
 1870 | 							((CanvasItem)flip.Node).Modulate = new Color(1f, 1f, 1f, 1f - num7);
 1871 | 						}
 1872 | 						if (num7 >= 1f && !finalized)
 1873 | 						{
 1874 | 							finalized = true;
 1875 | 							Finalize(screen);
 1876 | 						}
 1877 | 					}
 1878 | 					if (num4 > 0.12f)
 1879 | 					{
 1880 | 						for (int j = 0; j < 4; j++)
 1881 | 						{
 1882 | 							if (pending.Count <= 0)
 1883 | 							{
 1884 | 								break;
 1885 | 							}
 1886 | 							CardModel model = pending[0];
 1887 | 							pending.RemoveAt(0);
 1888 | 							Item item = Enumerable.FirstOrDefault<Item>((global::System.Collections.Generic.IEnumerable<Item>)items, (Func<Item, bool>)((Item item3) => item3.Card == model && item3.Slot == null));
 1889 | 							if (item != null)
 1890 | 							{
 1891 | 								Create(item);
 1892 | 							}
 1893 | 						}
 1894 | 					}
 1895 | 					((CanvasItem)empty).Visible = items.Count == 0 && num4 > 0.4f;
 1896 | 					float num9 = MaxScroll();
 1897 | 					if (!dragging)
 1898 | 					{
 1899 | 						if (target < 0f)
 1900 | 						{
 1901 | 							target = Mathf.Lerp(target, 0f, 0.2f);
 1902 | 						}
 1903 | 						if (target > num9)
 1904 | 						{
 1905 | 							target = Mathf.Lerp(target, num9, 0.2f);
 1906 | 						}
 1907 | 					}
 1908 | 					target = Mathf.Clamp(target, -120f, num9 + 120f);
 1909 | 					scroll = Mathf.Lerp(scroll, target, 0.2f);
 1910 | 					Enumerator<Section> enumerator = sections.GetEnumerator();
--- P3Makoto.Vfx/PileFx.cs:1954 ---
 1954 | 								Vector2 val14 = Screen(current2.At);
 1955 | 								float num12 = Fade(val14.Y - num11, val14.Y + num11);
 1956 | 								float num13 = Mathf.Clamp((num4 - current2.Born) / ((kind == Kind.Discard) ? 0.6f : 0.38f), 0f, 1f);
 1957 | 								float num14 = Ease.OutBack(num13);
 1958 | 								float num15 = 0f;
 1959 | 								float num16 = 1f;
 1960 | 								current2.Lift = Mathf.MoveToward(current2.Lift, (current2 == hovered) ? 1f : 0f, 0.12f);
 1961 | 								float num17 = Ease.OutCubic(current2.Lift);
 1962 | 								current2.Dim = Mathf.MoveToward(current2.Dim, (flag && current2 != hovered) ? 0.55f : 1f, 0.07f);
 1963 | 								switch (kind)
 1964 | 								{
 1965 | 								case Kind.Deck:
 1966 | 									val14 += new Vector2(160f, 0f) * k * (1f - Ease.OutExpo(num13));
 1967 | 									num14 = 1f;
 1968 | 									break;
 1969 | 								case Kind.Discard:
 1970 | 								{
 1971 | 									float num18 = 1f - Ease.OutCubic(num13);
 1972 | 									val14 += new Vector2(Mathf.Sin(num13 * (float)Math.PI * 2.2f) * 26f * num18, -190f * num18) * k;
 1973 | 									num15 = Mathf.DegToRad(16f) * Mathf.Sin(num13 * (float)Math.PI * 2.2f) * num18;
 1974 | 									num14 = 1f;
 1975 | 									break;
 1976 | 								}
 1977 | 								case Kind.Exhaust:
 1978 | 									num16 = 1f + 0.3f * (1f - Ease.OutCubic(num13));
 1979 | 									num14 = 1f;
 1980 | 									break;
 1981 | 								default:
 1982 | 									val14 += new Vector2(-40f, 46f) * k * (1f - num14);
 1983 | 									break;
 1984 | 								}
 1985 | 								val14 += new Vector2(0f, -14f) * k * num17;
 1986 | 								bool flag2 = num12 > 0.01f || current2 == hovered;
 1987 | 								((CanvasItem)current2.Slot).Visible = flag2;
 1988 | 								if (flag2)
 1989 | 								{
 1990 | 									float num19 = Mathf.DegToRad((L.Slant < 0f) ? 2f : ((L.Slant > 0f) ? (-2f) : 0f)) * (1f - num17) + num15;
 1991 | 									float num20 = num10 * (0.85f + 0.15f * num14) * num16 * (1f + 0.26f * num17) * (0.93f + 0.07f * Mathf.Max(num12, num17));
 1992 | 									float num21 = Mathf.Clamp(num13 * ((kind == Kind.Exhaust) ? 1.4f : 3f), 0f, 1f) * ((current2 == hovered) ? 1f : num12);
 1993 | 									if (current2 == focused)
 1994 | 									{
 1995 | 										Vector2 val15 = val11 + new Vector2(0f, Mathf.Sin(num4 * 1.6f) * 4f * k * num6);
 1996 | 										val14 = ((Vector2)(ref val14)).Lerp(val15, num6) + new Vector2(0f, -170f * k) * Mathf.Sin((float)Math.PI * num6);
 1997 | 										num20 = Mathf.Lerp(num20, 450f * k / val13.X, num6);
 1998 | 										num19 = Mathf.Lerp(num19, 0f, num6) + Mathf.DegToRad(-8f) * Mathf.Sin((float)Math.PI * num6);
--- P3Makoto.Vfx/PileFx.cs:2045 ---
 2045 | 										Vector2 val16 = current2.At - focused.At;
 2046 | 										float num25 = ((Vector2)(ref val16)).Length();
 2047 | 										float num26 = Ease.OutCubic(Mathf.Clamp(focusP * 1.6f - Mathf.Min(0.5f, num25 / 1600f), 0f, 1f));
 2048 | 										val14 += new Vector2(-24f, 80f) * k * num26;
 2049 | 										num20 *= 1f - 0.16f * num26;
 2050 | 										num19 += Mathf.DegToRad(-5f) * num26;
 2051 | 										num21 *= 1f - 0.9f * num26;
--- P3Makoto.Vfx/PileFx.cs:2077 ---
 2077 | 									current2.Slot.Position = val14;
 2078 | 									current2.Slot.Rotation = num19;
 2079 | 									float num28 = Mathf.Max(0.01f, ((Control)holder).Scale.X);
 2080 | 									current2.Slot.Scale = Vector2.One * (num20 / num28);
 2081 | 									float num29 = ((current2 == focused) ? 1f : current2.Dim);
 2082 | 									float num30 = ((kind == Kind.Exhaust && current2 != focused) ? 0.78f : 1f);
 2083 | 									((CanvasItem)current2.Slot).Modulate = new Color((num29 * 0.9f + 0.1f) * num30, (num29 * 0.94f + 0.06f) * (num30 + (1f - num30) * 0.4f), Mathf.Min(1f, num29 + 0.1f), num21);
 2084 | 								}
 2085 | 							}
 2086 | 						}
 2087 | 					}
 2088 | 					finally
 2089 | 					{
 2090 | 						((global::System.IDisposable)enumerator2/*cast due to .constrained prefix*/).Dispose();
 2091 | 					}
 2092 | 					if (flag)
 2093 | 					{
 2094 | 						Control val17 = hovered?.Slot;
 2095 | 						if (val17 != null && (object)((Node)val17).GetParent() == cards && ((Node)val17).GetIndex(false) != ((Node)cards).GetChildCount(false) - 1)
 2096 | 						{
 2097 | 							((Node)cards).MoveChild((Node)(object)val17, ((Node)cards).GetChildCount(false) - 1);
 2098 | 						}
 2099 | 					}
 2100 | 					if (flag && hovered != null)
 2101 | 					{
 2102 | 						Control slot = hovered.Slot;
 2103 | 						if (slot != null)
 2104 | 						{
 2105 | 							NGridCardHolder holder2 = hovered.Holder;
 2106 | 							if (holder2 != null)
 2107 | 							{
 2108 | 								Item item2 = hovered;
 2109 | 								if (GodotObject.IsInstanceValid((GodotObject)(object)slot) && GodotObject.IsInstanceValid((GodotObject)(object)holder2))
 2110 | 								{
 2111 | 									((CanvasItem)plate).Visible = true;
 2112 | 									float num31 = ((Vector2)((((Control)((NCardHolder)holder2).Hitbox).Size.X > 1f) ? ((Control)((NCardHolder)holder2).Hitbox).Size : new Vector2(300f, 422f))).Y * slot.Scale.Y * ((Control)holder2).Scale.Y * 0.5f;
 2113 | 									plate.Position = slot.Position + new Vector2(-20f * k, num31 + 8f * k);
 2114 | 									((Label)((Node)plate).GetChild(((Node)plate).GetChildCount(false) - 1, false)).Text = item2.Card.Title;
 2115 | 									float num32 = Ease.OutCubic(item2.Lift);
 2116 | 									((CanvasItem)plate).Modulate = new Color(1f, 1f, 1f, num32);
 2117 | 									plate.Scale = new Vector2(Mathf.Lerp(0.7f, 1f, num32), 1f);
```

## R07

卡片命中关系、错峰、边缘渐隐、排序与详情延后

原文件：`P3Makoto.Vfx/PileFx.cs`；原行：1193–1237、1272–1277、1552–1602、2415–2417。

```text
--- P3Makoto.Vfx/PileFx.cs:1193 ---
 1193 | 			val11 = NCard.Create(it.Card, (ModelVisibility)1);
 1194 | 			NGridCardHolder h = ((val11 != null) ? NGridCardHolder.Create(val11) : null);
 1195 | 			if (h == null)
 1196 | 			{
 1197 | 				if (val11 != null)
 1198 | 				{
 1199 | 					GodotTreeExtensions.QueueFreeSafely((Node)(object)val11);
 1200 | 				}
 1201 | 			}
 1202 | 			else
 1203 | 			{
 1204 | 				Control val12 = new Control
 1205 | 				{
 1206 | 					MouseFilter = (MouseFilterEnum)2,
 1207 | 					Modulate = new Color(1f, 1f, 1f, 0f)
 1208 | 				};
 1209 | 				((Node)cards).AddChild((Node)(object)val12, false, (InternalMode)0);
 1210 | 				((CanvasItem)h).Visible = true;
 1211 | 				((Node)val12).AddChild((Node)(object)h, false, (InternalMode)0);
 1212 | 				val11.UpdateVisuals(pile.Type, (CardPreviewMode)1);
 1213 | 				h.SetIsPreviewingUpgrade(upgradeOn && it.Card.IsUpgradable);
 1214 | 				it.Slot = val12;
 1215 | 				it.Holder = h;
 1216 | 				it.Born = Mathf.Max(Now(), nextBorn);
 1217 | 				nextBorn = it.Born + 0.022f;
 1218 | 				((Control)((NCardHolder)h).Hitbox).MouseEntered += (Action)delegate
 1219 | 				{
 1220 | 					if (hovered != it)
 1221 | 					{
 1222 | 						hovered = it;
 1223 | 						Sfx.Clip("Sys_Cursor", 0.35f);
 1224 | 					}
 1225 | 				};
 1226 | 				((Control)((NCardHolder)h).Hitbox).MouseExited += (Action)delegate
 1227 | 				{
 1228 | 					if (hovered == it)
 1229 | 					{
 1230 | 						hovered = null;
 1231 | 					}
 1232 | 				};
 1233 | 				((Control)((NCardHolder)h).Hitbox).GuiInput += (GuiInputEventHandler)delegate(InputEvent ev)
 1234 | 				{
 1237 | 					ModEntry.Safe("pile card input", (Action)delegate
--- P3Makoto.Vfx/PileFx.cs:1272 ---
 1272 | 		float Fade(float top, float bottom)
 1273 | 		{
 1274 | 			float num4 = Mathf.Max((bottom - top) * 0.65f, 60f * k);
 1275 | 			float num5 = Mathf.SmoothStep(0f, 1f, (top - (L.GridTop * k - num4)) / num4);
 1276 | 			float num6 = Mathf.SmoothStep(0f, 1f, (L.GridBottom * k + num4 - bottom) / num4);
 1277 | 			return num5 * num6;
--- P3Makoto.Vfx/PileFx.cs:1552 ---
 1552 | 			val11 = Enumerable.ToList<CardModel>((global::System.Collections.Generic.IEnumerable<CardModel>)pile.Cards);
 1553 | 			List<ValueTuple<string, string, List<CardModel>>> val12 = new List<ValueTuple<string, string, List<CardModel>>>();
 1554 | 			if (kind == Kind.Draw || kind == Kind.Deck)
 1555 | 			{
 1556 | 				global::System.Collections.Generic.IEnumerator<IGrouping<int, CardModel>> enumerator3 = ((global::System.Collections.Generic.IEnumerable<IGrouping<int, CardModel>>)Enumerable.OrderBy<IGrouping<int, CardModel>, int>(Enumerable.GroupBy<CardModel, int>((global::System.Collections.Generic.IEnumerable<CardModel>)val11, (Func<CardModel, int>)((CardModel c) => TypeOrder(c.Type))), (Func<IGrouping<int, CardModel>, int>)((IGrouping<int, CardModel> g) => g.Key))).GetEnumerator();
 1557 | 				try
 1558 | 				{
 1559 | 					while (((global::System.Collections.IEnumerator)enumerator3).MoveNext())
 1560 | 					{
 1561 | 						List<CardModel> val13 = Enumerable.ToList<CardModel>((global::System.Collections.Generic.IEnumerable<CardModel>)Enumerable.ThenBy<CardModel, int>(Enumerable.ThenBy<CardModel, string>(Enumerable.OrderBy<CardModel, int>((global::System.Collections.Generic.IEnumerable<CardModel>)enumerator3.Current, (Func<CardModel, int>)Cost), (Func<CardModel, string>)((CardModel c) => c.Title), (IComparer<string>)(object)StringComparer.Ordinal), (Func<CardModel, int>)((CardModel c) => c.IsUpgraded ? 1 : 0)));
 1562 | 						val12.Add(new ValueTuple<string, string, List<CardModel>>(TypeEn(val13[0].Type), TypeZh(val13[0].Type), val13));
 1563 | 					}
 1564 | 				}
 1565 | 				finally
 1566 | 				{
 1567 | 					((global::System.IDisposable)enumerator3)?.Dispose();
 1568 | 				}
 1569 | 			}
 1570 | 			else if (val11.Count > 0)
 1571 | 			{
 1572 | 				val11.Reverse();
 1573 | 				val12.Add(new ValueTuple<string, string, List<CardModel>>("RECENT", Zh ? "最新在前" : "", val11));
 1574 | 			}
 1575 | 			float num4 = 0f;
 1576 | 			int num5 = 0;
 1577 | 			Enumerator<ValueTuple<string, string, List<CardModel>>> enumerator4 = val12.GetEnumerator();
 1578 | 			try
 1579 | 			{
 1580 | 				while (enumerator4.MoveNext())
 1581 | 				{
 1582 | 					ValueTuple<string, string, List<CardModel>> current3 = enumerator4.Current;
 1583 | 					string item = current3.Item1;
 1584 | 					string item2 = current3.Item2;
 1585 | 					List<CardModel> item3 = current3.Item3;
 1586 | 					sections.Add(new Section
 1587 | 					{
 1588 | 						Head = SectionHead(heads, item, item2, item3.Count, font, k, (float)L.Cols * L.CellW),
 1589 | 						Y = num4
 1590 | 					});
 1591 | 					num4 += 58f;
 1592 | 					for (int num6 = 0; num6 < item3.Count; num6++)
 1593 | 					{
 1594 | 						pending.Add(item3[num6]);
 1595 | 						items.Add(new Item
 1596 | 						{
 1597 | 							Card = item3[num6],
 1598 | 							Index = num5++,
 1599 | 							At = new Vector2((float)(num6 % L.Cols) * L.CellW + L.CellW / 2f, num4 + (float)(num6 / L.Cols) * L.CellH + L.CellH / 2f)
 1600 | 						});
 1601 | 					}
 1602 | 					num4 += Mathf.Ceil((float)item3.Count / (float)L.Cols) * L.CellH + 16f;
--- P3Makoto.Vfx/PileFx.cs:2415 ---
 2415 | 			float num = (on ? Mathf.Clamp((p - 0.45f) / 0.4f, 0f, 1f) : e);
 2416 | 			((CanvasItem)f.Info).Modulate = new Color(1f, 1f, 1f, num);
 2417 | 			f.Info.Position = new Vector2(f.InfoBase - 90f * k * (1f - Ease.OutCubic(num)), 0f);
```

## R08

设置行：鼠标/键盘的整行强调

原文件：`P3Makoto.Scenes/SettingsSkin.cs`；原行：1474–1487、2337–2383。

```text
--- P3Makoto.Scenes/SettingsSkin.cs:1474 ---
 1474 | 				d.Deco = new Node2D
 1475 | 				{
 1476 | 					Name = StringName.op_Implicit("P3RowDeco"),
 1477 | 					ShowBehindParent = true
 1478 | 				};
 1479 | 				((Node)row).AddChild((Node)(object)d.Deco, false, (InternalMode)0);
 1480 | 				((Node)row).MoveChild((Node)(object)d.Deco, 0);
 1481 | 				d.Normal = new Node2D();
 1482 | 				d.Selected = new Node2D
 1483 | 				{
 1484 | 					Modulate = new Color(1f, 1f, 1f, 0f)
 1485 | 				};
 1486 | 				((Node)d.Deco).AddChild((Node)(object)d.Normal, false, (InternalMode)0);
 1487 | 				((Node)d.Deco).AddChild((Node)(object)d.Selected, false, (InternalMode)0);
--- P3Makoto.Scenes/SettingsSkin.cs:2337 ---
 2337 | 		Control val = ((Node)st.Screen).GetViewport().GuiGetFocusOwner();
 2338 | 		Vector2 mousePosition = ((Node)st.Screen).GetViewport().GetMousePosition();
 2339 | 		Rect2 globalRect = ((Control)st.Scroll).GetGlobalRect();
 2340 | 		Enumerator<RowDeco> enumerator2 = st.Rows.GetEnumerator();
 2341 | 		try
 2342 | 		{
 2343 | 			while (enumerator2.MoveNext())
 2344 | 			{
 2345 | 				RowDeco current2 = enumerator2.Current;
 2346 | 				if (!GodotObject.IsInstanceValid((GodotObject)(object)current2.Row) || !((CanvasItem)current2.Row).IsVisibleInTree())
 2347 | 				{
 2348 | 					continue;
 2349 | 				}
 2350 | 				Vector2 size = current2.Row.Size;
 2351 | 				if (!((Vector2)(ref current2.Built)).IsEqualApprox(size) && size.X > 4f && size.Y > 4f)
 2352 | 				{
 2353 | 					BuildRow(current2, size);
 2354 | 				}
 2355 | 				int num;
 2356 | 				if (((Rect2)(ref globalRect)).HasPoint(mousePosition))
 2357 | 				{
 2358 | 					Rect2 globalRect2 = current2.Row.GetGlobalRect();
 2359 | 					if (((Rect2)(ref globalRect2)).HasPoint(mousePosition))
 2360 | 					{
 2361 | 						num = 1;
 2362 | 						goto IL_017c;
 2363 | 					}
 2364 | 				}
 2365 | 				num = ((val != null && (val == current2.Row || ((Node)current2.Row).IsAncestorOf((Node)(object)val))) ? 1 : 0);
 2366 | 				goto IL_017c;
 2367 | 				IL_017c:
 2368 | 				bool flag = (byte)num != 0;
 2369 | 				current2.K = Mathf.MoveToward(current2.K, flag ? 1f : 0f, dt / 0.1f);
 2370 | 				float num2 = Ease.OutCubic(current2.K);
 2371 | 				((CanvasItem)current2.Selected).Modulate = new Color(1f, 1f, 1f, num2);
 2372 | 				current2.Deco.Position = new Vector2(8f * num2, 0f);
 2373 | 				Color white = Colors.White;
 2374 | 				Color selfModulate = ((Color)(ref white)).Lerp(new Color(0.06f, 0.1f, 0.35f, 1f), num2);
 2375 | 				Enumerator<CanvasItem> enumerator3 = current2.Labels.GetEnumerator();
 2376 | 				try
 2377 | 				{
 2378 | 					while (enumerator3.MoveNext())
 2379 | 					{
 2380 | 						CanvasItem current3 = enumerator3.Current;
 2381 | 						if (GodotObject.IsInstanceValid((GodotObject)(object)current3))
 2382 | 						{
 2383 | 							current3.SelfModulate = selfModulate;
```

## R09

稳定命中框、图形平滑、悬停提示和浮层定位

原文件：`P3MusicBox/MusicBox.cs`；原行：926–943、1381–1393、1446–1499。

```text
--- P3MusicBox/MusicBox.cs:926 ---
  926 | 		Control box = new Control
  927 | 		{
  928 | 			Size = new Vector2(52f, 52f),
  929 | 			MouseFilter = (MouseFilterEnum)0,
  930 | 			Name = StringName.op_Implicit("Button"),
  931 | 			PivotOffset = new Vector2(26f, 26f)
  932 | 		};
  933 | 		((Node)_layer).AddChild((Node)(object)box, false, (InternalMode)0);
  934 | 		_button = box;
  935 | 		Node2D val3 = new Node2D
  936 | 		{
  937 | 			Position = new Vector2(26f, 26f)
  938 | 		};
  939 | 		((Node)box).AddChild((Node)(object)val3, false, (InternalMode)0);
  940 | 		_icon = val3;
  941 | 		((Node)val3).AddChild((Node)new Polygon2D
  942 | 		{
  943 | 			Polygon = Circle(23f, 40),
--- P3MusicBox/MusicBox.cs:1381 ---
 1381 | 	private static Vector2 ClampOverlay(Vector2 at, Vector2 size)
 1382 | 	{
 1392 | 		Vector2 val = ViewSize();
 1393 | 		return new Vector2(Mathf.Clamp(at.X, 8f, Mathf.Max(8f, val.X - size.X - 8f)), Mathf.Clamp(at.Y, 8f, Mathf.Max(8f, val.Y - size.Y - 8f)));
--- P3MusicBox/MusicBox.cs:1446 ---
 1446 | 		bool flag2 = _state == State.Playing;
 1447 | 		float num = Mathf.Min(_hover ? 1.08f : 1f, Mathf.Min(ViewSize().X, ViewSize().Y) / 64f);
 1448 | 		Node2D? icon = _icon;
 1449 | 		Vector2 scale = _icon.Scale;
 1450 | 		icon.Scale = ((Vector2)(ref scale)).Lerp(Vector2.One * num, Mathf.Min(1f, dt * 14f));
 1451 | 		Node2D? ring = _ring;
 1452 | 		ring.Rotation += dt * (flag2 ? 0.9f : 0f);
 1453 | 		((CanvasItem)_ring).Modulate = new Color(1f, 1f, 1f, flag2 ? 1f : 0.35f);
 1454 | 		_rim.DefaultColor = new Color(Cyan, _hover ? 1f : (flag2 ? 0.9f : 0.55f));
 1455 | 		((CanvasItem)_glyph).Modulate = new Color(1f, 1f, 1f, flag2 ? 1f : 0.7f);
 1456 | 		((Control)_glyph).Position = new Vector2(-26f, -28f + (flag2 ? (2f * Mathf.Sin((float)now / 1000f * 4f)) : 0f));
 1457 | 		if (flag2 && !flag && now - _lastNote > 900)
 1458 | 		{
 1459 | 			_lastNote = now;
 1460 | 			FloatNote();
 1461 | 		}
 1462 | 		float a;
 1463 | 		Label? hoverTitle;
 1464 | 		float num2;
 1465 | 		if (_hoverTitle != null)
 1466 | 		{
 1467 | 			string text = ((Songs.Count == 0) ? "（没有歌曲）" : (Songs[_index].Title + ((_state == State.Playing) ? "" : ((_state == State.Paused) ? "  (暂停)" : "  (点击打开音乐盒)"))));
 1468 | 			_hoverTitle.Text = text;
 1469 | 			((Control)_hoverTitle).Size = new Vector2(520f, 30f);
 1470 | 			((Control)_hoverTitle).Position = ClampOverlay(_button.Position + new Vector2((_button.Position.X < 532f) ? 62f : (-532f), 11f), ((Control)_hoverTitle).Size);
 1471 | 			a = ((CanvasItem)_hoverTitle).Modulate.A;
 1472 | 			hoverTitle = _hoverTitle;
 1473 | 			if (_hover && !flag)
 1474 | 			{
 1475 | 				Control? popup = _popup;
 1476 | 				if (popup == null || !((CanvasItem)popup).Visible)
 1477 | 				{
 1478 | 					num2 = 1f;
 1479 | 					goto IL_0313;
 1480 | 				}
 1481 | 			}
 1482 | 			num2 = 0f;
 1483 | 			goto IL_0313;
 1484 | 		}
 1485 | 		goto IL_0329;
 1486 | 		IL_0329:
 1487 | 		if (_popup != null && ((CanvasItem)_popup).Visible)
 1488 | 		{
 1489 | 			Vector2 val = _button.Position + new Vector2(52f - _popup.Size.X, 60f);
 1490 | 			if (val.Y + _popup.Size.Y > ViewSize().Y - 8f)
 1491 | 			{
 1492 | 				val.Y = _button.Position.Y - _popup.Size.Y - 8f;
 1493 | 			}
 1494 | 			_popup.Position = ClampOverlay(val, _popup.Size);
 1495 | 		}
 1496 | 		return;
 1497 | 		IL_0313:
 1498 | 		((CanvasItem)hoverTitle).Modulate = new Color(1f, 1f, 1f, Mathf.MoveToward(a, num2, dt * 6f));
 1499 | 		goto IL_0329;
```

## R10

文本交接、非对称开关、当前选项反色

原文件：`P3MusicBox/MusicBox.cs`；原行：1544–1563、1996–2023、2104–2134。

```text
--- P3MusicBox/MusicBox.cs:1544 ---
 1544 | 	private static void ShowLyric(string text)
 1545 | 	{
 1546 | 		if (_lyric.Length >= 2 && !(text == _lyricShown))
 1547 | 		{
 1548 | 			_lyricShown = text;
 1549 | 			Label c = _lyric[_lyricSlot];
 1550 | 			_lyricSlot = 1 - _lyricSlot;
 1551 | 			Label obj = _lyric[_lyricSlot];
 1552 | 			obj.Text = text;
 1553 | 			Fade((CanvasItem)(object)c, 0f, 0.35f);
 1554 | 			Fade((CanvasItem)(object)obj, (text.Length > 0) ? 1f : 0f, 0.35f);
 1555 | 		}
 1556 | 	}
 1557 | 
 1558 | 	private static void Fade(CanvasItem c, float to, float seconds)
 1559 | 	{
 1561 | 		((Node)c).CreateTween().TweenProperty((GodotObject)(object)c, NodePath.op_Implicit("modulate:a"), Variant.op_Implicit(to), (double)seconds).SetTrans((TransitionType)1)
 1562 | 			.SetEase((EaseType)2);
 1563 | 	}
--- P3MusicBox/MusicBox.cs:1996 ---
 1996 | 	private static void TogglePopup()
 1997 | 	{
 1999 | 		if (_popup != null && _catcher != null)
 2000 | 		{
 2001 | 			if (((CanvasItem)_popup).Visible)
 2002 | 			{
 2003 | 				ClosePopup();
 2004 | 				return;
 2005 | 			}
 2006 | 			RefreshList();
 2007 | 			((CanvasItem)_catcher).Visible = true;
 2008 | 			((CanvasItem)_popup).Visible = true;
 2009 | 			((CanvasItem)_popup).Modulate = new Color(1f, 1f, 1f, 0f);
 2010 | 			Fade((CanvasItem)(object)_popup, 1f, 0.15f);
 2011 | 		}
 2012 | 	}
 2013 | 
 2014 | 	private static void ClosePopup()
 2015 | 	{
 2016 | 		if (_popup != null && _catcher != null)
 2017 | 		{
 2018 | 			if (((CanvasItem)_popup).Visible)
 2019 | 			{
 2020 | 				_lastClickFrame = Engine.GetProcessFrames();
 2021 | 			}
 2022 | 			((CanvasItem)_popup).Visible = false;
 2023 | 			((CanvasItem)_catcher).Visible = false;
--- P3MusicBox/MusicBox.cs:2104 ---
 2104 | 			bool flag = i == _index && _state != State.Stopped;
 2105 | 			Button val = new Button
 2106 | 			{
 2107 | 				Text = $"{i + 1:00}  {Songs[i].Title}" + ((Songs[i].Artist.Length > 0) ? ("  ·  " + Songs[i].Artist) : ""),
 2108 | 				Alignment = (HorizontalAlignment)0,
 2109 | 				FocusMode = (FocusModeEnum)0,
 2110 | 				ClipText = true,
 2111 | 				CustomMinimumSize = new Vector2(400f, 34f)
 2112 | 			};
 2113 | 			if (_font != null)
 2114 | 			{
 2115 | 				((Control)val).AddThemeFontOverride(StringName.op_Implicit("font"), _font);
 2116 | 			}
 2117 | 			((Control)val).AddThemeFontSizeOverride(StringName.op_Implicit("font_size"), 16);
 2118 | 			((Control)val).AddThemeStyleboxOverride(StringName.op_Implicit("normal"), (StyleBox)new StyleBoxFlat
 2119 | 			{
 2120 | 				BgColor = (flag ? new Color(0.96f, 0.98f, 1f, 1f) : new Color(0f, 0f, 0f, 0f)),
 2121 | 				ContentMarginLeft = 10f
 2122 | 			});
 2123 | 			((Control)val).AddThemeStyleboxOverride(StringName.op_Implicit("hover"), (StyleBox)new StyleBoxFlat
 2124 | 			{
 2125 | 				BgColor = (Color)(flag ? Colors.White : new Color(Cyan, 0.35f)),
 2126 | 				ContentMarginLeft = 10f
 2127 | 			});
 2128 | 			((Control)val).AddThemeStyleboxOverride(StringName.op_Implicit("pressed"), (StyleBox)new StyleBoxFlat
 2129 | 			{
 2130 | 				BgColor = Cyan,
 2131 | 				ContentMarginLeft = 10f
 2132 | 			});
 2133 | 			((Control)val).AddThemeColorOverride(StringName.op_Implicit("font_color"), (Color)(flag ? new Color(0.04f, 0.1f, 0.35f, 1f) : Colors.White));
 2134 | 			((Control)val).AddThemeColorOverride(StringName.op_Implicit("font_hover_color"), (Color)(flag ? new Color(0.04f, 0.1f, 0.35f, 1f) : Colors.White));
```

## R11

点击/拖动阈值与比例位置

原文件：`P3MusicBox/IconDrag.cs`；原行：70–122、131–180。

```text
--- P3MusicBox/IconDrag.cs:70 ---
   72 | 		if (!Pressed)
   73 | 		{
   74 | 			Pressed = true;
   75 | 			bool dragging = (Moved = false);
   76 | 			Dragging = dragging;
   77 | 			downAt = now;
   78 | 			pressAt = cursor;
   79 | 			offset = cursor - position;
   80 | 			Position = (original = position);
   81 | 			travel = 0f;
   82 | 		}
   83 | 	}
   84 | 
   85 | 	internal void Step(ulong now, Vector2 cursor, Vector2 viewport)
   86 | 	{
   96 | 		if (Pressed)
   97 | 		{
   98 | 			travel = MathF.Max(travel, Vector2.Distance(cursor, pressAt));
   99 | 			if (now - downAt >= 450 || travel >= 6f)
  100 | 			{
  101 | 				Dragging = true;
  102 | 			}
  103 | 			if (Dragging)
  104 | 			{
  105 | 				Position = Clamp(cursor - offset, viewport);
  106 | 				Moved |= Vector2.DistanceSquared(Position, original) > 0.25f;
  107 | 			}
  108 | 		}
  109 | 	}
  110 | 
  111 | 	internal bool Release(ulong now, Vector2 cursor, Vector2 viewport, bool inside)
  112 | 	{
  115 | 		if (!Pressed)
  116 | 		{
  117 | 			return false;
  118 | 		}
  119 | 		Step(now, cursor, viewport);
  120 | 		bool result = !Dragging && travel <= 8f && inside;
  121 | 		Pressed = false;
  122 | 		return result;
--- P3MusicBox/IconDrag.cs:131 ---
  131 | 	private static float Margin(float extent)
  132 | 	{
  133 | 		return MathF.Min(8f, MathF.Max(0f, (extent - 52f) / 2f));
  134 | 	}
  135 | 
  136 | 	private static float Span(float extent)
  137 | 	{
  138 | 		return MathF.Max(0f, extent - 52f - 2f * Margin(extent));
  139 | 	}
  140 | 
  141 | 	internal static Vector2 Clamp(Vector2 p, Vector2 view)
  142 | 	{
  154 | 		return new Vector2(Math.Clamp(float.IsFinite(p.X) ? p.X : 8f, Margin(view.X), Margin(view.X) + Span(view.X)), Math.Clamp(float.IsFinite(p.Y) ? p.Y : 8f, Margin(view.Y), Margin(view.Y) + Span(view.Y)));
  155 | 	}
  156 | 
  157 | 	internal static Vector2 FromSaved(Vector2 unit, Vector2 view)
  158 | 	{
  168 | 		return Clamp(new Vector2(Margin(view.X) + Span(view.X) * unit.X, Margin(view.Y) + Span(view.Y) * unit.Y), view);
  169 | 	}
  170 | 
  171 | 	internal static Vector2 ToSaved(Vector2 p, Vector2 view)
  172 | 	{
  180 | 		return new Vector2(Math.Clamp((p.X - Margin(view.X)) / MathF.Max(1f, Span(view.X)), 0f, 1f), Math.Clamp((p.Y - Margin(view.Y)) / MathF.Max(1f, Span(view.Y)), 0f, 1f));
```

## R12

连续反馈的时窗和错位

原文件：`P3Makoto.Vfx/Popups.cs`；原行：25–32、284–295、413–450。

```text
--- P3Makoto.Vfx/Popups.cs:25 ---
   25 | 	private static readonly Vector2[] Slots = (Vector2[])(object)new Vector2[6]
   26 | 	{
   27 | 		new Vector2(0f, 0f),
   28 | 		new Vector2(-95f, 55f),
   29 | 		new Vector2(85f, 70f),
   30 | 		new Vector2(-40f, -75f),
   31 | 		new Vector2(110f, -40f),
   32 | 		new Vector2(10f, 120f)
--- P3Makoto.Vfx/Popups.cs:284 ---
  284 | 		ulong ticksMsec = Time.GetTicksMsec();
  285 | 		ValueTuple<ulong, int> val = default(ValueTuple<ulong, int>);
  286 | 		int num = ((Stack.TryGetValue(targetId, ref val) && ticksMsec - val.Item1 < 600) ? (val.Item2 + 1) : 0);
  287 | 		Stack[targetId] = new ValueTuple<ulong, int>(ticksMsec, num);
  288 | 		Vector2 val2 = at + new Vector2(80f, -80f) + Slots[num % Slots.Length];
  289 | 		Node2D val3 = Fx.Root(layer, val2, "P3DamageNum");
  290 | 		int num2 = ((amount >= 30) ? 150 : ((amount >= 10) ? 128 : 112));
  291 | 		string text = amount.ToString();
  292 | 		Node2D val4 = BlockText(val3, text, num2, Face, 8);
  293 | 		val4.Position = new Vector2((float)(-num2) * 0.3f * (float)text.Length, (float)(-num2) * 0.7f);
  294 | 		Animate(val3, val2, 0.5f, Fx.Rand(-0.12f, -0.04f));
  295 | 		LandImpact(layer, val3, val4, val2, text, num2, (amount >= 30) ? 1.3f : 1f);
--- P3Makoto.Vfx/Popups.cs:413 ---
  413 | 	public static void Block(Control layer, Vector2 center, float s = 1f)
  414 | 	{
  428 | 		Vector2 impact = center + new Vector2(50f, -10f) * s;
  429 | 		Vector2 home = center + new Vector2(62f, -62f) * s;
  430 | 		ulong ticksMsec = Time.GetTicksMsec();
  431 | 		bool chain = ticksMsec - _lastBlock < 700;
  432 | 		_lastBlock = ticksMsec;
  433 | 		Node2D old = _lastWord;
  434 | 		if (old != null && GodotObject.IsInstanceValid((GodotObject)(object)old))
  435 | 		{
  436 | 			((Node)old).Name = StringName.op_Implicit("P3BlockOld");
  437 | 			Fx.Animate((Node)(object)old, 0.07999999821186066, delegate(float t)
  438 | 			{
  441 | 				((CanvasItem)old).Modulate = new Color(1f, 1f, 1f, ((CanvasItem)old).Modulate.A * (1f - t));
  442 | 			});
  443 | 			Fx.FreeAfter((Node)(object)old, 0.1);
  444 | 		}
  445 | 		_lastWord = BlockWord(layer, home, s);
  446 | 		Fx.After((Node)(object)layer, 0.05, "block impact", (Action)delegate
  447 | 		{
  449 | 			BlockImpact(layer, impact, s, chain);
  450 | 		});
```

## R13

资源准备入口及骨骼预热取舍

原文件：`P3Makoto.Vfx/Preload.cs`；原行：83–134。

```text
--- P3Makoto.Vfx/Preload.cs:83 ---
   83 | 		if (_started)
   84 | 		{
   85 | 			return;
   86 | 		}
   87 | 		MainLoop mainLoop = Engine.GetMainLoop();
   88 | 		SceneTree val = (SceneTree)(object)((mainLoop is SceneTree) ? mainLoop : null);
   89 | 		if (val == null)
   90 | 		{
   91 | 			return;
   92 | 		}
   93 | 		_started = true;
   94 | 		_t0 = Time.GetTicksMsec();
   95 | 		GD.Print("[P3Makoto] perf preload: startup threaded Spine warmup disabled; serial idle warmup scheduled");
   96 | 		string[] paths = Paths;
   97 | 		foreach (string text in paths)
   98 | 		{
   99 | 			if (!text.EndsWith("_skel_data.tres", (StringComparison)4) && ResourceLoader.Exists(text, "") && (int)ResourceLoader.LoadThreadedRequest(text, "", false, (CacheMode)1) == 0)
  100 | 			{
  101 | 				Pending.Add(text);
  102 | 			}
  103 | 		}
  104 | 		object obj = _003C_003EO._003C0_003E__Poll;
  105 | 		if (obj == null)
  106 | 		{
  107 | 			Action val2 = Poll;
  108 | 			_003C_003EO._003C0_003E__Poll = val2;
  109 | 			obj = (object)val2;
  110 | 		}
  111 | 		val.ProcessFrame += (Action)obj;
  112 | 		object obj2 = _003C_003Ec._003C_003E9__8_0;
  113 | 		if (obj2 == null)
  114 | 		{
  115 | 			Action val3 = delegate
  116 | 			{
  120 | 				object obj3 = _003C_003EO._003C1_003E__Warm;
  121 | 				if (obj3 == null)
  122 | 				{
  123 | 					Action val5 = Warm;
  124 | 					_003C_003EO._003C1_003E__Warm = val5;
  125 | 					obj3 = (object)val5;
  126 | 				}
  127 | 				ModEntry.Safe("shader warmup", (Action)obj3);
  128 | 			};
  129 | 			_003C_003Ec._003C_003E9__8_0 = val3;
  130 | 			obj2 = (object)val3;
  131 | 		}
  132 | 		Callable val4 = Callable.From((Action)obj2);
  133 | 		((Callable)(ref val4)).CallDeferred(global::System.Array.Empty<Variant>());
  134 | 		IdleWarmup.Start();
```

## R14

空闲条件下逐项预热

原文件：`P3Makoto.Vfx/IdleWarmup.cs`；原行：477–533。

```text
--- P3Makoto.Vfx/IdleWarmup.cs:477 ---
  477 | 	private static void Step()
  478 | 	{
  479 | 		if (active != null)
  480 | 		{
  481 | 			if (++frames >= 4)
  482 | 			{
  483 | 				if (GodotObject.IsInstanceValid((GodotObject)(object)active))
  484 | 				{
  485 | 					((Node)active).QueueFree();
  486 | 				}
  487 | 				active = null;
  488 | 				nextCheck = Time.GetTicksMsec() + 150;
  489 | 			}
  490 | 			return;
  491 | 		}
  492 | 		if (Jobs.Count == 0)
  493 | 		{
  494 | 			Complete = failed == 0;
  495 | 			GD.Print($"{"[P3Makoto]"} perf pile idle warmup finished; complete={Complete}; failed={failed}");
  496 | 			Stop();
  497 | 			return;
  498 | 		}
  499 | 		ulong ticksMsec = Time.GetTicksMsec();
  500 | 		if (ticksMsec < nextCheck)
  501 | 		{
  502 | 			return;
  503 | 		}
  504 | 		nextCheck = ticksMsec + 150;
  505 | 		int num;
  506 | 		if (Preload.OrdinaryReady)
  507 | 		{
  508 | 			NCapstoneContainer instance = NCapstoneContainer.Instance;
  509 | 			if ((instance == null || !instance.InUse) && NativeIdle())
  510 | 			{
  511 | 				num = (MenuOrMap() ? 1 : 0);
  512 | 				goto IL_00ff;
  513 | 			}
  514 | 		}
  515 | 		num = 0;
  516 | 		goto IL_00ff;
  517 | 		IL_00ff:
  518 | 		bool eligible = (byte)num != 0;
  519 | 		if (Gate.Ready(ticksMsec, eligible))
  520 | 		{
  521 | 			string text = Jobs.Dequeue();
  522 | 			ulong ticksUsec = Time.GetTicksUsec();
  523 | 			try
  524 | 			{
  525 | 				WarmOne(text);
  526 | 			}
  527 | 			catch (global::System.Exception e)
  528 | 			{
  529 | 				failed++;
  530 | 				ModEntry.Report("idle warmup " + text, e);
  531 | 			}
  532 | 			GD.Print($"{"[P3Makoto]"} perf idle warmup {text} {(float)(Time.GetTicksUsec() - ticksUsec) / 1000f:0.0}ms; {Jobs.Count} remaining");
  533 | 		}
```
