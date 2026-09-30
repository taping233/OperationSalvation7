import "./chunk-G3PMV62Z.js";

// ../../../../node_modules/inkjs/dist/ink.mjs
var t = class _t {
  constructor() {
    if (this._components = [], this._componentsString = null, this._isRelative = false, "string" == typeof arguments[0]) {
      let t2 = arguments[0];
      this.componentsString = t2;
    } else if (arguments[0] instanceof _t.Component && arguments[1] instanceof _t) {
      let t2 = arguments[0], e2 = arguments[1];
      this._components.push(t2), this._components = this._components.concat(e2._components);
    } else if (arguments[0] instanceof Array) {
      let t2 = arguments[0], e2 = !!arguments[1];
      this._components = this._components.concat(t2), this._isRelative = e2;
    }
  }
  get isRelative() {
    return this._isRelative;
  }
  get componentCount() {
    return this._components.length;
  }
  get head() {
    return this._components.length > 0 ? this._components[0] : null;
  }
  get tail() {
    if (this._components.length >= 2) {
      let e2 = this._components.slice(1, this._components.length);
      return new _t(e2);
    }
    return _t.self;
  }
  get length() {
    return this._components.length;
  }
  get lastComponent() {
    let t2 = this._components.length - 1;
    return t2 >= 0 ? this._components[t2] : null;
  }
  get containsNamedComponent() {
    for (let t2 = 0, e2 = this._components.length; t2 < e2; t2++) if (!this._components[t2].isIndex) return true;
    return false;
  }
  static get self() {
    let e2 = new _t();
    return e2._isRelative = true, e2;
  }
  GetComponent(t2) {
    return this._components[t2];
  }
  PathByAppendingPath(e2) {
    let n2 = new _t(), i2 = 0;
    for (let t2 = 0; t2 < e2._components.length && e2._components[t2].isParent; ++t2) i2++;
    for (let t2 = 0; t2 < this._components.length - i2; ++t2) n2._components.push(this._components[t2]);
    for (let t2 = i2; t2 < e2._components.length; ++t2) n2._components.push(e2._components[t2]);
    return n2;
  }
  get componentsString() {
    return null == this._componentsString && (this._componentsString = this._components.join("."), this.isRelative && (this._componentsString = "." + this._componentsString)), this._componentsString;
  }
  set componentsString(e2) {
    if (this._components.length = 0, this._componentsString = e2, null == this._componentsString || "" == this._componentsString) return;
    "." == this._componentsString[0] && (this._isRelative = true, this._componentsString = this._componentsString.substring(1));
    let n2 = this._componentsString.split(".");
    for (let e3 of n2) /^(\-|\+)?([0-9]+|Infinity)$/.test(e3) ? this._components.push(new _t.Component(parseInt(e3))) : this._components.push(new _t.Component(e3));
  }
  toString() {
    return this.componentsString;
  }
  Equals(t2) {
    if (null == t2) return false;
    if (t2._components.length != this._components.length) return false;
    if (t2.isRelative != this.isRelative) return false;
    for (let e2 = 0, n2 = t2._components.length; e2 < n2; e2++) if (!t2._components[e2].Equals(this._components[e2])) return false;
    return true;
  }
  PathByAppendingComponent(e2) {
    let n2 = new _t();
    return n2._components.push(...this._components), n2._components.push(e2), n2;
  }
};
var e;
var n;
var i;
var r;
function a(t2, e2) {
  return t2 instanceof e2 ? u(t2) : null;
}
function s(t2, e2) {
  if (t2 instanceof e2) return u(t2);
  throw new Error(`${t2} is not of type ${e2}`);
}
function l(t2) {
  return t2.hasValidName && t2.name ? t2 : null;
}
function o(t2) {
  return void 0 === t2 ? null : t2;
}
function h(t2) {
  return "object" == typeof t2 && "function" == typeof t2.Equals;
}
function u(t2, e2) {
  return t2;
}
t.parentId = "^", (function(t2) {
  class e2 {
    constructor(t3) {
      this.index = -1, this.name = null, "string" == typeof t3 ? this.name = t3 : this.index = t3;
    }
    get isIndex() {
      return this.index >= 0;
    }
    get isParent() {
      return this.name == t2.parentId;
    }
    static ToParent() {
      return new e2(t2.parentId);
    }
    toString() {
      return this.isIndex ? this.index.toString() : this.name;
    }
    Equals(t3) {
      return null != t3 && t3.isIndex == this.isIndex && (this.isIndex ? this.index == t3.index : this.name == t3.name);
    }
  }
  t2.Component = e2;
})(t || (t = {})), (function(t2) {
  function e2(t3, e3) {
    if (!t3) throw void 0 !== e3 && console.warn(e3), console.trace && console.trace(), new Error("");
  }
  t2.AssertType = function(t3, n2, i2) {
    e2(t3 instanceof n2, i2);
  }, t2.Assert = e2;
})(e || (e = {}));
var c = class extends Error {
};
function d(t2) {
  throw new c(`${t2} is null or undefined`);
}
var p = class {
  constructor() {
    this.parent = null, this._debugMetadata = null, this._path = null;
  }
  get debugMetadata() {
    return null === this._debugMetadata && this.parent ? this.parent.debugMetadata : this._debugMetadata;
  }
  set debugMetadata(t2) {
    this._debugMetadata = t2;
  }
  get ownDebugMetadata() {
    return this._debugMetadata;
  }
  DebugLineNumberOfPath(t2) {
    if (null === t2) return null;
    let e2 = this.rootContentContainer;
    if (e2) {
      let n2 = e2.ContentAtPath(t2).obj;
      if (n2) {
        let t3 = n2.debugMetadata;
        if (null !== t3) return t3.startLineNumber;
      }
    }
    return null;
  }
  get path() {
    if (null == this._path) if (null == this.parent) this._path = new t();
    else {
      let e2 = [], n2 = this, i2 = a(n2.parent, A);
      for (; null !== i2; ) {
        let r2 = l(n2);
        if (null != r2 && r2.hasValidName) {
          if (null === r2.name) return d("namedChild.name");
          e2.unshift(new t.Component(r2.name));
        } else e2.unshift(new t.Component(i2.content.indexOf(n2)));
        n2 = i2, i2 = a(i2.parent, A);
      }
      this._path = new t(e2);
    }
    return this._path;
  }
  ResolvePath(t2) {
    if (null === t2) return d("path");
    if (t2.isRelative) {
      let n2 = a(this, A);
      return null === n2 && (e.Assert(null !== this.parent, "Can't resolve relative path because we don't have a parent"), n2 = a(this.parent, A), e.Assert(null !== n2, "Expected parent to be a container"), e.Assert(t2.GetComponent(0).isParent), t2 = t2.tail), null === n2 ? d("nearestContainer") : n2.ContentAtPath(t2);
    }
    {
      let e2 = this.rootContentContainer;
      return null === e2 ? d("contentContainer") : e2.ContentAtPath(t2);
    }
  }
  ConvertPathToRelative(e2) {
    let n2 = this.path, i2 = Math.min(e2.length, n2.length), r2 = -1;
    for (let t2 = 0; t2 < i2; ++t2) {
      let i3 = n2.GetComponent(t2), a3 = e2.GetComponent(t2);
      if (!i3.Equals(a3)) break;
      r2 = t2;
    }
    if (-1 == r2) return e2;
    let a2 = n2.componentCount - 1 - r2, s2 = [];
    for (let e3 = 0; e3 < a2; ++e3) s2.push(t.Component.ToParent());
    for (let t2 = r2 + 1; t2 < e2.componentCount; ++t2) s2.push(e2.GetComponent(t2));
    return new t(s2, true);
  }
  CompactPathString(t2) {
    let e2 = null, n2 = null;
    if (t2.isRelative) n2 = t2.componentsString, e2 = this.path.PathByAppendingPath(t2).componentsString;
    else {
      n2 = this.ConvertPathToRelative(t2).componentsString, e2 = t2.componentsString;
    }
    return n2.length < e2.length ? n2 : e2;
  }
  get rootContentContainer() {
    let t2 = this;
    for (; t2.parent; ) t2 = t2.parent;
    return a(t2, A);
  }
  Copy() {
    throw Error("Not Implemented: Doesn't support copying");
  }
  SetChild(t2, e2, n2) {
    t2[e2] && (t2[e2] = null), t2[e2] = n2, t2[e2] && (t2[e2].parent = this);
  }
  Equals(t2) {
    return t2 === this;
  }
};
var m = class {
  constructor(t2) {
    t2 = void 0 !== t2 ? t2.toString() : "", this.string = t2;
  }
  get Length() {
    return this.string.length;
  }
  Append(t2) {
    null !== t2 && (this.string += t2);
  }
  AppendLine(t2) {
    void 0 !== t2 && this.Append(t2), this.string += "\n";
  }
  AppendFormat(t2) {
    for (var e2 = arguments.length, n2 = new Array(e2 > 1 ? e2 - 1 : 0), i2 = 1; i2 < e2; i2++) n2[i2 - 1] = arguments[i2];
    this.string += t2.replace(/{(\d+)}/g, ((t3, e3) => void 0 !== n2[e3] ? n2[e3] : t3));
  }
  toString() {
    return this.string;
  }
  Clear() {
    this.string = "";
  }
};
var f = class _f {
  constructor() {
    if (this.originName = null, this.itemName = null, void 0 !== arguments[1]) {
      let t2 = arguments[0], e2 = arguments[1];
      this.originName = t2, this.itemName = e2;
    } else if (arguments[0]) {
      let t2 = arguments[0].toString().split(".");
      this.originName = t2[0], this.itemName = t2[1];
    }
  }
  static get Null() {
    return new _f(null, null);
  }
  get isNull() {
    return null == this.originName && null == this.itemName;
  }
  get fullName() {
    return (null !== this.originName ? this.originName : "?") + "." + this.itemName;
  }
  toString() {
    return this.fullName;
  }
  Equals(t2) {
    if (t2 instanceof _f) {
      let e2 = t2;
      return e2.itemName == this.itemName && e2.originName == this.originName;
    }
    return false;
  }
  copy() {
    return new _f(this.originName, this.itemName);
  }
  serialized() {
    return JSON.stringify({ originName: this.originName, itemName: this.itemName });
  }
  static fromSerializedKey(t2) {
    let e2 = JSON.parse(t2);
    if (!_f.isLikeInkListItem(e2)) return _f.Null;
    let n2 = e2;
    return new _f(n2.originName, n2.itemName);
  }
  static isLikeInkListItem(t2) {
    return "object" == typeof t2 && (!(!t2.hasOwnProperty("originName") || !t2.hasOwnProperty("itemName")) && (("string" == typeof t2.originName || null === typeof t2.originName) && ("string" == typeof t2.itemName || null === typeof t2.itemName)));
  }
};
var g = class _g extends Map {
  constructor() {
    if (super(arguments[0] instanceof _g ? arguments[0] : []), this.origins = null, this._originNames = [], arguments[0] instanceof _g) {
      let t2 = arguments[0], e2 = t2.originNames;
      null !== e2 && (this._originNames = e2.slice()), null !== t2.origins && (this.origins = t2.origins.slice());
    } else if ("string" == typeof arguments[0]) {
      let t2 = arguments[0], e2 = arguments[1];
      if (this.SetInitialOriginName(t2), null === e2.listDefinitions) return d("originStory.listDefinitions");
      let n2 = e2.listDefinitions.TryListGetDefinition(t2, null);
      if (!n2.exists) throw new Error("InkList origin could not be found in story when constructing new list: " + t2);
      if (null === n2.result) return d("def.result");
      this.origins = [n2.result];
    } else if ("object" == typeof arguments[0] && arguments[0].hasOwnProperty("Key") && arguments[0].hasOwnProperty("Value")) {
      let t2 = arguments[0];
      this.Add(t2.Key, t2.Value);
    }
  }
  static FromString(t2, e2) {
    var n2;
    if (null == t2 || "" == t2) return new _g();
    let i2 = null === (n2 = e2.listDefinitions) || void 0 === n2 ? void 0 : n2.FindSingleItemListWithName(t2);
    if (i2) return null === i2.value ? d("listValue.value") : new _g(i2.value);
    throw new Error("Could not find the InkListItem from the string '" + t2 + "' to create an InkList because it doesn't exist in the original list definition in ink.");
  }
  AddItem(t2) {
    let e2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : null;
    if (t2 instanceof f) {
      let e3 = t2;
      if (null == e3.originName) return void this.AddItem(e3.itemName);
      if (null === this.origins) return d("this.origins");
      for (let t3 of this.origins) if (t3.name == e3.originName) {
        let n2 = t3.TryGetValueForItem(e3, 0);
        if (n2.exists) return void this.Add(e3, n2.result);
        throw new Error("Could not add the item " + e3 + " to this list because it doesn't exist in the original list definition in ink.");
      }
      throw new Error("Failed to add item to list because the item was from a new list definition that wasn't previously known to this list. Only items from previously known lists can be used, so that the int value can be found.");
    }
    if (null !== t2) {
      let n2 = t2, i2 = null;
      if (null === this.origins) return d("this.origins");
      for (let t3 of this.origins) {
        if (null === n2) return d("itemName");
        if (t3.ContainsItemWithName(n2)) {
          if (null != i2) throw new Error("Could not add the item " + n2 + " to this list because it could come from either " + t3.name + " or " + i2.name);
          i2 = t3;
        }
      }
      if (null == i2) {
        if (null == e2) throw new Error("Could not add the item " + n2 + " to this list because it isn't known to any list definitions previously associated with this list.");
        {
          let t3 = _g.FromString(n2, e2).orderedItems[0];
          this.Add(t3.Key, t3.Value);
        }
      } else {
        let t3 = new f(i2.name, n2), e3 = i2.ValueForItem(t3);
        this.Add(t3, e3);
      }
    }
  }
  ContainsItemNamed(t2) {
    for (let [e2] of this) {
      if (f.fromSerializedKey(e2).itemName == t2) return true;
    }
    return false;
  }
  ContainsKey(t2) {
    return this.has(t2.serialized());
  }
  Add(t2, e2) {
    let n2 = t2.serialized();
    if (this.has(n2)) throw new Error(`The Map already contains an entry for ${t2}`);
    this.set(n2, e2);
  }
  Remove(t2) {
    return this.delete(t2.serialized());
  }
  get Count() {
    return this.size;
  }
  get originOfMaxItem() {
    if (null == this.origins) return null;
    let t2 = this.maxItem.Key.originName, e2 = null;
    return this.origins.every(((n2) => n2.name != t2 || (e2 = n2, false))), e2;
  }
  get originNames() {
    if (this.Count > 0) {
      null == this._originNames && this.Count > 0 ? this._originNames = [] : (this._originNames || (this._originNames = []), this._originNames.length = 0);
      for (let [t2] of this) {
        let e2 = f.fromSerializedKey(t2);
        if (null === e2.originName) return d("item.originName");
        this._originNames.push(e2.originName);
      }
    }
    return this._originNames;
  }
  SetInitialOriginName(t2) {
    this._originNames = [t2];
  }
  SetInitialOriginNames(t2) {
    this._originNames = null == t2 ? null : t2.slice();
  }
  get maxItem() {
    let t2 = { Key: f.Null, Value: 0 };
    for (let [e2, n2] of this) {
      let i2 = f.fromSerializedKey(e2);
      (t2.Key.isNull || n2 > t2.Value) && (t2 = { Key: i2, Value: n2 });
    }
    return t2;
  }
  get minItem() {
    let t2 = { Key: f.Null, Value: 0 };
    for (let [e2, n2] of this) {
      let i2 = f.fromSerializedKey(e2);
      (t2.Key.isNull || n2 < t2.Value) && (t2 = { Key: i2, Value: n2 });
    }
    return t2;
  }
  get inverse() {
    let t2 = new _g();
    if (null != this.origins) for (let e2 of this.origins) for (let [n2, i2] of e2.items) {
      let e3 = f.fromSerializedKey(n2);
      this.ContainsKey(e3) || t2.Add(e3, i2);
    }
    return t2;
  }
  get all() {
    let t2 = new _g();
    if (null != this.origins) for (let e2 of this.origins) for (let [n2, i2] of e2.items) {
      let e3 = f.fromSerializedKey(n2);
      t2.set(e3.serialized(), i2);
    }
    return t2;
  }
  Union(t2) {
    let e2 = new _g(this);
    for (let [n2, i2] of t2) e2.set(n2, i2);
    return e2;
  }
  Intersect(t2) {
    let e2 = new _g();
    for (let [n2, i2] of this) t2.has(n2) && e2.set(n2, i2);
    return e2;
  }
  HasIntersection(t2) {
    for (let [e2] of this) if (t2.has(e2)) return true;
    return false;
  }
  Without(t2) {
    let e2 = new _g(this);
    for (let [n2] of t2) e2.delete(n2);
    return e2;
  }
  Contains(t2) {
    if ("string" == typeof t2) return this.ContainsItemNamed(t2);
    const e2 = t2;
    if (0 == e2.size || 0 == this.size) return false;
    for (let [t3] of e2) if (!this.has(t3)) return false;
    return true;
  }
  GreaterThan(t2) {
    return 0 != this.Count && (0 == t2.Count || this.minItem.Value > t2.maxItem.Value);
  }
  GreaterThanOrEquals(t2) {
    return 0 != this.Count && (0 == t2.Count || this.minItem.Value >= t2.minItem.Value && this.maxItem.Value >= t2.maxItem.Value);
  }
  LessThan(t2) {
    return 0 != t2.Count && (0 == this.Count || this.maxItem.Value < t2.minItem.Value);
  }
  LessThanOrEquals(t2) {
    return 0 != t2.Count && (0 == this.Count || this.maxItem.Value <= t2.maxItem.Value && this.minItem.Value <= t2.minItem.Value);
  }
  MaxAsList() {
    return this.Count > 0 ? new _g(this.maxItem) : new _g();
  }
  MinAsList() {
    return this.Count > 0 ? new _g(this.minItem) : new _g();
  }
  ListWithSubRange(t2, e2) {
    if (0 == this.Count) return new _g();
    let n2 = this.orderedItems, i2 = 0, r2 = Number.MAX_SAFE_INTEGER;
    Number.isInteger(t2) ? i2 = t2 : t2 instanceof _g && t2.Count > 0 && (i2 = t2.minItem.Value), Number.isInteger(e2) ? r2 = e2 : e2 instanceof _g && e2.Count > 0 && (r2 = e2.maxItem.Value);
    let a2 = new _g();
    a2.SetInitialOriginNames(this.originNames);
    for (let t3 of n2) t3.Value >= i2 && t3.Value <= r2 && a2.Add(t3.Key, t3.Value);
    return a2;
  }
  Equals(t2) {
    if (t2 instanceof _g == false) return false;
    if (t2.Count != this.Count) return false;
    for (let [e2] of this) if (!t2.has(e2)) return false;
    return true;
  }
  get orderedItems() {
    let t2 = new Array();
    for (let [e2, n2] of this) {
      let i2 = f.fromSerializedKey(e2);
      t2.push({ Key: i2, Value: n2 });
    }
    return t2.sort(((t3, e2) => null === t3.Key.originName ? d("x.Key.originName") : null === e2.Key.originName ? d("y.Key.originName") : t3.Value == e2.Value ? t3.Key.originName.localeCompare(e2.Key.originName) : t3.Value < e2.Value ? -1 : t3.Value > e2.Value ? 1 : 0)), t2;
  }
  get singleItem() {
    for (let t2 of this.orderedItems) return t2.Key;
    return null;
  }
  toString() {
    let t2 = this.orderedItems, e2 = new m();
    for (let n2 = 0; n2 < t2.length; n2++) {
      n2 > 0 && e2.Append(", ");
      let i2 = t2[n2].Key;
      if (null === i2.itemName) return d("item.itemName");
      e2.Append(i2.itemName);
    }
    return e2.toString();
  }
  valueOf() {
    return NaN;
  }
};
var S = class extends Error {
  constructor(t2) {
    super(t2), this.useEndLineNumber = false, this.message = t2, this.name = "StoryException";
  }
};
function y(t2, e2, n2) {
  if (null === t2) return { result: n2, exists: false };
  let i2 = t2.get(e2);
  return void 0 === i2 ? { result: n2, exists: false } : { result: i2, exists: true };
}
var v = class _v extends p {
  static Create(e2, i2) {
    if (i2) {
      if (i2 === n.Int && Number.isInteger(Number(e2))) return new _(Number(e2));
      if (i2 === n.Float && !isNaN(e2)) return new w(Number(e2));
    }
    return "boolean" == typeof e2 ? new b(Boolean(e2)) : "string" == typeof e2 ? new T(String(e2)) : Number.isInteger(Number(e2)) ? new _(Number(e2)) : isNaN(e2) ? e2 instanceof t ? new E(s(e2, t)) : e2 instanceof g ? new N(s(e2, g)) : null : new w(Number(e2));
  }
  Copy() {
    return s(_v.Create(this.valueObject), p);
  }
  BadCastException(t2) {
    return new S("Can't cast " + this.valueObject + " from " + this.valueType + " to " + t2);
  }
};
var C = class extends v {
  constructor(t2) {
    super(), this.value = t2;
  }
  get valueObject() {
    return this.value;
  }
  toString() {
    return null === this.value ? d("Value.value") : this.value.toString();
  }
};
var b = class extends C {
  constructor(t2) {
    super(t2 || false);
  }
  get isTruthy() {
    return Boolean(this.value);
  }
  get valueType() {
    return n.Bool;
  }
  Cast(t2) {
    if (null === this.value) return d("Value.value");
    if (t2 == this.valueType) return this;
    if (t2 == n.Int) return new _(this.value ? 1 : 0);
    if (t2 == n.Float) return new w(this.value ? 1 : 0);
    if (t2 == n.String) return new T(this.value ? "true" : "false");
    throw this.BadCastException(t2);
  }
  toString() {
    return this.value ? "true" : "false";
  }
};
var _ = class extends C {
  constructor(t2) {
    super(t2 || 0);
  }
  get isTruthy() {
    return 0 != this.value;
  }
  get valueType() {
    return n.Int;
  }
  Cast(t2) {
    if (null === this.value) return d("Value.value");
    if (t2 == this.valueType) return this;
    if (t2 == n.Bool) return new b(0 !== this.value);
    if (t2 == n.Float) return new w(this.value);
    if (t2 == n.String) return new T("" + this.value);
    throw this.BadCastException(t2);
  }
};
var w = class extends C {
  constructor(t2) {
    super(t2 || 0);
  }
  get isTruthy() {
    return 0 != this.value;
  }
  get valueType() {
    return n.Float;
  }
  Cast(t2) {
    if (null === this.value) return d("Value.value");
    if (t2 == this.valueType) return this;
    if (t2 == n.Bool) return new b(0 !== this.value);
    if (t2 == n.Int) return new _(this.value);
    if (t2 == n.String) return new T("" + this.value);
    throw this.BadCastException(t2);
  }
};
var T = class extends C {
  constructor(t2) {
    if (super(t2 || ""), this._isNewline = "\n" == this.value, this._isInlineWhitespace = true, null === this.value) return d("Value.value");
    this.value.length > 0 && this.value.split("").every(((t3) => " " == t3 || "	" == t3 || (this._isInlineWhitespace = false, false)));
  }
  get valueType() {
    return n.String;
  }
  get isTruthy() {
    return null === this.value ? d("Value.value") : this.value.length > 0;
  }
  get isNewline() {
    return this._isNewline;
  }
  get isInlineWhitespace() {
    return this._isInlineWhitespace;
  }
  get isNonWhitespace() {
    return !this.isNewline && !this.isInlineWhitespace;
  }
  Cast(t2) {
    if (t2 == this.valueType) return this;
    if (t2 == n.Int) {
      let e2 = (function(t3) {
        let e3 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : 0, n2 = parseInt(t3);
        return Number.isNaN(n2) ? { result: e3, exists: false } : { result: n2, exists: true };
      })(this.value);
      if (e2.exists) return new _(e2.result);
      throw this.BadCastException(t2);
    }
    if (t2 == n.Float) {
      let e2 = (function(t3) {
        let e3 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : 0, n2 = parseFloat(t3);
        return Number.isNaN(n2) ? { result: e3, exists: false } : { result: n2, exists: true };
      })(this.value);
      if (e2.exists) return new w(e2.result);
      throw this.BadCastException(t2);
    }
    throw this.BadCastException(t2);
  }
};
var E = class extends C {
  constructor() {
    super(arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : null);
  }
  get valueType() {
    return n.DivertTarget;
  }
  get targetPath() {
    return null === this.value ? d("Value.value") : this.value;
  }
  set targetPath(t2) {
    this.value = t2;
  }
  get isTruthy() {
    throw new Error("Shouldn't be checking the truthiness of a divert target");
  }
  Cast(t2) {
    if (t2 == this.valueType) return this;
    throw this.BadCastException(t2);
  }
  toString() {
    return "DivertTargetValue(" + this.targetPath + ")";
  }
};
var P = class _P extends C {
  constructor(t2) {
    let e2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : -1;
    super(t2), this._contextIndex = e2;
  }
  get contextIndex() {
    return this._contextIndex;
  }
  set contextIndex(t2) {
    this._contextIndex = t2;
  }
  get variableName() {
    return null === this.value ? d("Value.value") : this.value;
  }
  set variableName(t2) {
    this.value = t2;
  }
  get valueType() {
    return n.VariablePointer;
  }
  get isTruthy() {
    throw new Error("Shouldn't be checking the truthiness of a variable pointer");
  }
  Cast(t2) {
    if (t2 == this.valueType) return this;
    throw this.BadCastException(t2);
  }
  toString() {
    return "VariablePointerValue(" + this.variableName + ")";
  }
  Copy() {
    return new _P(this.variableName, this.contextIndex);
  }
};
var N = class _N extends C {
  get isTruthy() {
    return null === this.value ? d("this.value") : this.value.Count > 0;
  }
  get valueType() {
    return n.List;
  }
  Cast(t2) {
    if (null === this.value) return d("Value.value");
    if (t2 == n.Int) {
      let t3 = this.value.maxItem;
      return t3.Key.isNull ? new _(0) : new _(t3.Value);
    }
    if (t2 == n.Float) {
      let t3 = this.value.maxItem;
      return t3.Key.isNull ? new w(0) : new w(t3.Value);
    }
    if (t2 == n.String) {
      let t3 = this.value.maxItem;
      return t3.Key.isNull ? new T("") : new T(t3.Key.toString());
    }
    if (t2 == this.valueType) return this;
    throw this.BadCastException(t2);
  }
  constructor(t2, e2) {
    super(null), t2 || e2 ? t2 instanceof g ? this.value = new g(t2) : t2 instanceof f && "number" == typeof e2 && (this.value = new g({ Key: t2, Value: e2 })) : this.value = new g();
  }
  static RetainListOriginsForAssignment(t2, e2) {
    let n2 = a(t2, _N), i2 = a(e2, _N);
    return i2 && null === i2.value ? d("newList.value") : n2 && null === n2.value ? d("oldList.value") : void (n2 && i2 && 0 == i2.value.Count && i2.value.SetInitialOriginNames(n2.value.originNames));
  }
};
!(function(t2) {
  t2[t2.Bool = -1] = "Bool", t2[t2.Int = 0] = "Int", t2[t2.Float = 1] = "Float", t2[t2.List = 2] = "List", t2[t2.String = 3] = "String", t2[t2.DivertTarget = 4] = "DivertTarget", t2[t2.VariablePointer = 5] = "VariablePointer";
})(n || (n = {}));
var O = class _O {
  constructor() {
    this.obj = null, this.approximate = false;
  }
  get correctObj() {
    return this.approximate ? null : this.obj;
  }
  get container() {
    return this.obj instanceof A ? this.obj : null;
  }
  copy() {
    let t2 = new _O();
    return t2.obj = this.obj, t2.approximate = this.approximate, t2;
  }
};
var A = class _A extends p {
  constructor() {
    super(...arguments), this.name = null, this._content = [], this.namedContent = /* @__PURE__ */ new Map(), this.visitsShouldBeCounted = false, this.turnIndexShouldBeCounted = false, this.countingAtStartOnly = false, this._pathToFirstLeafContent = null;
  }
  get hasValidName() {
    return null != this.name && this.name.length > 0;
  }
  get content() {
    return this._content;
  }
  set content(t2) {
    this.AddContent(t2);
  }
  get namedOnlyContent() {
    let t2 = /* @__PURE__ */ new Map();
    for (let [e2, n2] of this.namedContent) {
      let i2 = s(n2, p);
      t2.set(e2, i2);
    }
    for (let e2 of this.content) {
      let n2 = l(e2);
      null != n2 && n2.hasValidName && t2.delete(n2.name);
    }
    return 0 == t2.size && (t2 = null), t2;
  }
  set namedOnlyContent(t2) {
    let e2 = this.namedOnlyContent;
    if (null != e2) for (let [t3] of e2) this.namedContent.delete(t3);
    if (null != t2) for (let [, e3] of t2) {
      let t3 = l(e3);
      null != t3 && this.AddToNamedContentOnly(t3);
    }
  }
  get countFlags() {
    let t2 = 0;
    return this.visitsShouldBeCounted && (t2 |= _A.CountFlags.Visits), this.turnIndexShouldBeCounted && (t2 |= _A.CountFlags.Turns), this.countingAtStartOnly && (t2 |= _A.CountFlags.CountStartOnly), t2 == _A.CountFlags.CountStartOnly && (t2 = 0), t2;
  }
  set countFlags(t2) {
    let e2 = t2;
    (e2 & _A.CountFlags.Visits) > 0 && (this.visitsShouldBeCounted = true), (e2 & _A.CountFlags.Turns) > 0 && (this.turnIndexShouldBeCounted = true), (e2 & _A.CountFlags.CountStartOnly) > 0 && (this.countingAtStartOnly = true);
  }
  get pathToFirstLeafContent() {
    return null == this._pathToFirstLeafContent && (this._pathToFirstLeafContent = this.path.PathByAppendingPath(this.internalPathToFirstLeafContent)), this._pathToFirstLeafContent;
  }
  get internalPathToFirstLeafContent() {
    let e2 = [], n2 = this;
    for (; n2 instanceof _A; ) n2.content.length > 0 && (e2.push(new t.Component(0)), n2 = n2.content[0]);
    return new t(e2);
  }
  AddContent(t2) {
    if (t2 instanceof Array) {
      let e2 = t2;
      for (let t3 of e2) this.AddContent(t3);
    } else {
      let e2 = t2;
      if (this._content.push(e2), e2.parent) throw new Error("content is already in " + e2.parent);
      e2.parent = this, this.TryAddNamedContent(e2);
    }
  }
  TryAddNamedContent(t2) {
    let e2 = l(t2);
    null != e2 && e2.hasValidName && this.AddToNamedContentOnly(e2);
  }
  AddToNamedContentOnly(t2) {
    if (e.AssertType(t2, p, "Can only add Runtime.Objects to a Runtime.Container"), s(t2, p).parent = this, null === t2.name) return d("namedContentObj.name");
    this.namedContent.set(t2.name, t2);
  }
  ContentAtPath(t2) {
    let e2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : 0, n2 = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : -1;
    -1 == n2 && (n2 = t2.length);
    let i2 = new O();
    i2.approximate = false;
    let r2 = this, s2 = this;
    for (let l2 = e2; l2 < n2; ++l2) {
      let e3 = t2.GetComponent(l2);
      if (null == r2) {
        i2.approximate = true;
        break;
      }
      let o2 = r2.ContentWithPathComponent(e3);
      if (null == o2) {
        i2.approximate = true;
        break;
      }
      const h2 = a(o2, _A);
      if (l2 < n2 - 1 && null == h2) {
        i2.approximate = true;
        break;
      }
      s2 = o2, r2 = h2;
    }
    return i2.obj = s2, i2;
  }
  InsertContent(t2, e2) {
    if (this.content.splice(e2, 0, t2), t2.parent) throw new Error("content is already in " + t2.parent);
    t2.parent = this, this.TryAddNamedContent(t2);
  }
  AddContentsOfContainer(t2) {
    this.content.push(...t2.content);
    for (let e2 of t2.content) e2.parent = this, this.TryAddNamedContent(e2);
  }
  ContentWithPathComponent(t2) {
    if (t2.isIndex) return t2.index >= 0 && t2.index < this.content.length ? this.content[t2.index] : null;
    if (t2.isParent) return this.parent;
    {
      if (null === t2.name) return d("component.name");
      let e2 = y(this.namedContent, t2.name, null);
      return e2.exists ? s(e2.result, p) : null;
    }
  }
  BuildStringOfHierarchy() {
    let t2;
    if (0 == arguments.length) return t2 = new m(), this.BuildStringOfHierarchy(t2, 0, null), t2.toString();
    t2 = arguments[0];
    let n2 = arguments[1], i2 = arguments[2];
    function r2() {
      for (let e2 = 0; e2 < 4 * n2; ++e2) t2.Append(" ");
    }
    r2(), t2.Append("["), this.hasValidName && t2.AppendFormat(" ({0})", this.name), this == i2 && t2.Append("  <---"), t2.AppendLine(), n2++;
    for (let e2 = 0; e2 < this.content.length; ++e2) {
      let a3 = this.content[e2];
      if (a3 instanceof _A) {
        a3.BuildStringOfHierarchy(t2, n2, i2);
      } else r2(), a3 instanceof T ? (t2.Append('"'), t2.Append(a3.toString().replace("\n", "\\n")), t2.Append('"')) : t2.Append(a3.toString());
      e2 != this.content.length - 1 && t2.Append(","), a3 instanceof _A || a3 != i2 || t2.Append("  <---"), t2.AppendLine();
    }
    let a2 = /* @__PURE__ */ new Map();
    for (let [t3, e2] of this.namedContent) this.content.indexOf(s(e2, p)) >= 0 || a2.set(t3, e2);
    if (a2.size > 0) {
      r2(), t2.AppendLine("-- named: --");
      for (let [, r3] of a2) {
        e.AssertType(r3, _A, "Can only print out named Containers"), r3.BuildStringOfHierarchy(t2, n2, i2), t2.AppendLine();
      }
    }
    n2--, r2(), t2.Append("]");
  }
};
!(function(t2) {
  var e2;
  (e2 = t2.CountFlags || (t2.CountFlags = {}))[e2.Start = 0] = "Start", e2[e2.Visits = 1] = "Visits", e2[e2.Turns = 2] = "Turns", e2[e2.CountStartOnly = 4] = "CountStartOnly";
})(A || (A = {}));
var x = class extends p {
  toString() {
    return "Glue";
  }
};
var I = class _I extends p {
  get commandType() {
    return this._commandType;
  }
  constructor() {
    let t2 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : _I.CommandType.NotSet;
    super(), this._commandType = t2;
  }
  Copy() {
    return new _I(this.commandType);
  }
  static EvalStart() {
    return new _I(_I.CommandType.EvalStart);
  }
  static EvalOutput() {
    return new _I(_I.CommandType.EvalOutput);
  }
  static EvalEnd() {
    return new _I(_I.CommandType.EvalEnd);
  }
  static Duplicate() {
    return new _I(_I.CommandType.Duplicate);
  }
  static PopEvaluatedValue() {
    return new _I(_I.CommandType.PopEvaluatedValue);
  }
  static PopFunction() {
    return new _I(_I.CommandType.PopFunction);
  }
  static PopTunnel() {
    return new _I(_I.CommandType.PopTunnel);
  }
  static BeginString() {
    return new _I(_I.CommandType.BeginString);
  }
  static EndString() {
    return new _I(_I.CommandType.EndString);
  }
  static NoOp() {
    return new _I(_I.CommandType.NoOp);
  }
  static ChoiceCount() {
    return new _I(_I.CommandType.ChoiceCount);
  }
  static Turns() {
    return new _I(_I.CommandType.Turns);
  }
  static TurnsSince() {
    return new _I(_I.CommandType.TurnsSince);
  }
  static ReadCount() {
    return new _I(_I.CommandType.ReadCount);
  }
  static Random() {
    return new _I(_I.CommandType.Random);
  }
  static SeedRandom() {
    return new _I(_I.CommandType.SeedRandom);
  }
  static VisitIndex() {
    return new _I(_I.CommandType.VisitIndex);
  }
  static SequenceShuffleIndex() {
    return new _I(_I.CommandType.SequenceShuffleIndex);
  }
  static StartThread() {
    return new _I(_I.CommandType.StartThread);
  }
  static Done() {
    return new _I(_I.CommandType.Done);
  }
  static End() {
    return new _I(_I.CommandType.End);
  }
  static ListFromInt() {
    return new _I(_I.CommandType.ListFromInt);
  }
  static ListRange() {
    return new _I(_I.CommandType.ListRange);
  }
  static ListRandom() {
    return new _I(_I.CommandType.ListRandom);
  }
  static BeginTag() {
    return new _I(_I.CommandType.BeginTag);
  }
  static EndTag() {
    return new _I(_I.CommandType.EndTag);
  }
  toString() {
    return "ControlCommand " + this.commandType.toString();
  }
};
!(function(t2) {
  var e2;
  (e2 = t2.CommandType || (t2.CommandType = {}))[e2.NotSet = -1] = "NotSet", e2[e2.EvalStart = 0] = "EvalStart", e2[e2.EvalOutput = 1] = "EvalOutput", e2[e2.EvalEnd = 2] = "EvalEnd", e2[e2.Duplicate = 3] = "Duplicate", e2[e2.PopEvaluatedValue = 4] = "PopEvaluatedValue", e2[e2.PopFunction = 5] = "PopFunction", e2[e2.PopTunnel = 6] = "PopTunnel", e2[e2.BeginString = 7] = "BeginString", e2[e2.EndString = 8] = "EndString", e2[e2.NoOp = 9] = "NoOp", e2[e2.ChoiceCount = 10] = "ChoiceCount", e2[e2.Turns = 11] = "Turns", e2[e2.TurnsSince = 12] = "TurnsSince", e2[e2.ReadCount = 13] = "ReadCount", e2[e2.Random = 14] = "Random", e2[e2.SeedRandom = 15] = "SeedRandom", e2[e2.VisitIndex = 16] = "VisitIndex", e2[e2.SequenceShuffleIndex = 17] = "SequenceShuffleIndex", e2[e2.StartThread = 18] = "StartThread", e2[e2.Done = 19] = "Done", e2[e2.End = 20] = "End", e2[e2.ListFromInt = 21] = "ListFromInt", e2[e2.ListRange = 22] = "ListRange", e2[e2.ListRandom = 23] = "ListRandom", e2[e2.BeginTag = 24] = "BeginTag", e2[e2.EndTag = 25] = "EndTag", e2[e2.TOTAL_VALUES = 26] = "TOTAL_VALUES";
})(I || (I = {})), (function(t2) {
  t2[t2.Tunnel = 0] = "Tunnel", t2[t2.Function = 1] = "Function", t2[t2.FunctionEvaluationFromGame = 2] = "FunctionEvaluationFromGame";
})(i || (i = {}));
var k = class _k {
  constructor() {
    this.container = null, this.index = -1, 2 === arguments.length && (this.container = arguments[0], this.index = arguments[1]);
  }
  Resolve() {
    return this.index < 0 ? this.container : null == this.container ? null : 0 == this.container.content.length ? this.container : this.index >= this.container.content.length ? null : this.container.content[this.index];
  }
  get isNull() {
    return null == this.container;
  }
  get path() {
    return this.isNull ? null : this.index >= 0 ? this.container.path.PathByAppendingComponent(new t.Component(this.index)) : this.container.path;
  }
  toString() {
    return this.container ? "Ink Pointer -> " + this.container.path.toString() + " -- index " + this.index : "Ink Pointer (null)";
  }
  copy() {
    return new _k(this.container, this.index);
  }
  static StartOf(t2) {
    return new _k(t2, 0);
  }
  static get Null() {
    return new _k(null, -1);
  }
};
var F = class _F extends p {
  get targetPath() {
    if (null != this._targetPath && this._targetPath.isRelative) {
      let t2 = this.targetPointer.Resolve();
      t2 && (this._targetPath = t2.path);
    }
    return this._targetPath;
  }
  set targetPath(t2) {
    this._targetPath = t2, this._targetPointer = k.Null;
  }
  get targetPointer() {
    if (this._targetPointer.isNull) {
      let t2 = this.ResolvePath(this._targetPath).obj;
      if (null === this._targetPath) return d("this._targetPath");
      if (null === this._targetPath.lastComponent) return d("this._targetPath.lastComponent");
      if (this._targetPath.lastComponent.isIndex) {
        if (null === t2) return d("targetObj");
        this._targetPointer.container = t2.parent instanceof A ? t2.parent : null, this._targetPointer.index = this._targetPath.lastComponent.index;
      } else this._targetPointer = k.StartOf(t2 instanceof A ? t2 : null);
    }
    return this._targetPointer.copy();
  }
  get targetPathString() {
    return null == this.targetPath ? null : this.CompactPathString(this.targetPath);
  }
  set targetPathString(e2) {
    this.targetPath = null == e2 ? null : new t(e2);
  }
  get hasVariableTarget() {
    return null != this.variableDivertName;
  }
  constructor(t2) {
    super(), this._targetPath = null, this._targetPointer = k.Null, this.variableDivertName = null, this.pushesToStack = false, this.stackPushType = 0, this.isExternal = false, this.externalArgs = 0, this.isConditional = false, this.pushesToStack = false, void 0 !== t2 && (this.pushesToStack = true, this.stackPushType = t2);
  }
  Equals(t2) {
    let e2 = t2;
    return e2 instanceof _F && this.hasVariableTarget == e2.hasVariableTarget && (this.hasVariableTarget ? this.variableDivertName == e2.variableDivertName : null === this.targetPath ? d("this.targetPath") : this.targetPath.Equals(e2.targetPath));
  }
  toString() {
    if (this.hasVariableTarget) return "Divert(variable: " + this.variableDivertName + ")";
    if (null == this.targetPath) return "Divert(null)";
    {
      let t2 = new m(), e2 = this.targetPath.toString();
      return t2.Append("Divert"), this.isConditional && t2.Append("?"), this.pushesToStack && (this.stackPushType == i.Function ? t2.Append(" function") : t2.Append(" tunnel")), t2.Append(" -> "), t2.Append(this.targetPathString), t2.Append(" ("), t2.Append(e2), t2.Append(")"), t2.toString();
    }
  }
};
var W = class extends p {
  constructor() {
    let t2 = !(arguments.length > 0 && void 0 !== arguments[0]) || arguments[0];
    super(), this._pathOnChoice = null, this.hasCondition = false, this.hasStartContent = false, this.hasChoiceOnlyContent = false, this.isInvisibleDefault = false, this.onceOnly = true, this.onceOnly = t2;
  }
  get pathOnChoice() {
    if (null != this._pathOnChoice && this._pathOnChoice.isRelative) {
      let t2 = this.choiceTarget;
      t2 && (this._pathOnChoice = t2.path);
    }
    return this._pathOnChoice;
  }
  set pathOnChoice(t2) {
    this._pathOnChoice = t2;
  }
  get choiceTarget() {
    return null === this._pathOnChoice ? d("ChoicePoint._pathOnChoice") : this.ResolvePath(this._pathOnChoice).container;
  }
  get pathStringOnChoice() {
    return null === this.pathOnChoice ? d("ChoicePoint.pathOnChoice") : this.CompactPathString(this.pathOnChoice);
  }
  set pathStringOnChoice(e2) {
    this.pathOnChoice = new t(e2);
  }
  get flags() {
    let t2 = 0;
    return this.hasCondition && (t2 |= 1), this.hasStartContent && (t2 |= 2), this.hasChoiceOnlyContent && (t2 |= 4), this.isInvisibleDefault && (t2 |= 8), this.onceOnly && (t2 |= 16), t2;
  }
  set flags(t2) {
    this.hasCondition = (1 & t2) > 0, this.hasStartContent = (2 & t2) > 0, this.hasChoiceOnlyContent = (4 & t2) > 0, this.isInvisibleDefault = (8 & t2) > 0, this.onceOnly = (16 & t2) > 0;
  }
  toString() {
    if (null === this.pathOnChoice) return d("ChoicePoint.pathOnChoice");
    return "Choice: -> " + this.pathOnChoice.toString();
  }
};
var V = class extends p {
  get containerForCount() {
    return null === this.pathForCount ? null : this.ResolvePath(this.pathForCount).container;
  }
  get pathStringForCount() {
    return null === this.pathForCount ? null : this.CompactPathString(this.pathForCount);
  }
  set pathStringForCount(e2) {
    this.pathForCount = null === e2 ? null : new t(e2);
  }
  constructor() {
    let t2 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : null;
    super(), this.pathForCount = null, this.name = t2;
  }
  toString() {
    if (null != this.name) return "var(" + this.name + ")";
    return "read_count(" + this.pathStringForCount + ")";
  }
};
var L = class extends p {
  constructor(t2, e2) {
    super(), this.variableName = t2 || null, this.isNewDeclaration = !!e2, this.isGlobal = false;
  }
  toString() {
    return "VarAssign to " + this.variableName;
  }
};
var D = class extends p {
  toString() {
    return "Void";
  }
};
var R = class _R extends p {
  static CallWithName(t2) {
    return new _R(t2);
  }
  static CallExistsWithName(t2) {
    return this.GenerateNativeFunctionsIfNecessary(), this._nativeFunctions.get(t2);
  }
  get name() {
    return null === this._name ? d("NativeFunctionCall._name") : this._name;
  }
  set name(t2) {
    this._name = t2, this._isPrototype || (null === _R._nativeFunctions ? d("NativeFunctionCall._nativeFunctions") : this._prototype = _R._nativeFunctions.get(this._name) || null);
  }
  get numberOfParameters() {
    return this._prototype ? this._prototype.numberOfParameters : this._numberOfParameters;
  }
  set numberOfParameters(t2) {
    this._numberOfParameters = t2;
  }
  Call(t2) {
    if (this._prototype) return this._prototype.Call(t2);
    if (this.numberOfParameters != t2.length) throw new Error("Unexpected number of parameters");
    let e2 = false;
    for (let n2 of t2) {
      if (n2 instanceof D) throw new S("Attempting to perform " + this.name + ' on a void value. Did you forget to "return" a value from a function you called here?');
      n2 instanceof N && (e2 = true);
    }
    if (2 == t2.length && e2) return this.CallBinaryListOperation(t2);
    let i2 = this.CoerceValuesToSingleType(t2), r2 = i2[0].valueType;
    return r2 == n.Int || r2 == n.Float || r2 == n.String || r2 == n.DivertTarget || r2 == n.List ? this.CallType(i2) : null;
  }
  CallType(t2) {
    let e2 = s(t2[0], C), i2 = e2.valueType, r2 = e2, a2 = t2.length;
    if (2 == a2 || 1 == a2) {
      if (null === this._operationFuncs) return d("NativeFunctionCall._operationFuncs");
      let l2 = this._operationFuncs.get(i2);
      if (!l2) {
        const t3 = n[i2];
        throw new S("Cannot perform operation " + this.name + " on " + t3);
      }
      if (2 == a2) {
        let e3 = s(t2[1], C), n2 = l2;
        if (null === r2.value || null === e3.value) return d("NativeFunctionCall.Call BinaryOp values");
        let i3 = n2(r2.value, e3.value);
        return C.Create(i3);
      }
      {
        let t3 = l2;
        if (null === r2.value) return d("NativeFunctionCall.Call UnaryOp value");
        let i3 = t3(r2.value);
        return this.name === _R.Int ? C.Create(i3, n.Int) : this.name === _R.Float ? C.Create(i3, n.Float) : C.Create(i3, e2.valueType);
      }
    }
    throw new Error("Unexpected number of parameters to NativeFunctionCall: " + t2.length);
  }
  CallBinaryListOperation(t2) {
    if (("+" == this.name || "-" == this.name) && t2[0] instanceof N && t2[1] instanceof _) return this.CallListIncrementOperation(t2);
    let e2 = s(t2[0], C), i2 = s(t2[1], C);
    if (!("&&" != this.name && "||" != this.name || e2.valueType == n.List && i2.valueType == n.List)) {
      if (null === this._operationFuncs) return d("NativeFunctionCall._operationFuncs");
      let t3 = this._operationFuncs.get(n.Int);
      if (null === t3) return d("NativeFunctionCall.CallBinaryListOperation op");
      let r2 = (function(t4) {
        if ("boolean" == typeof t4) return t4;
        throw new Error(`${t4} is not a boolean`);
      })(t3(e2.isTruthy ? 1 : 0, i2.isTruthy ? 1 : 0));
      return new b(r2);
    }
    if (e2.valueType == n.List && i2.valueType == n.List) return this.CallType([e2, i2]);
    throw new S("Can not call use " + this.name + " operation on " + n[e2.valueType] + " and " + n[i2.valueType]);
  }
  CallListIncrementOperation(t2) {
    let e2 = s(t2[0], N), i2 = s(t2[1], _), r2 = new g();
    if (null === e2.value) return d("NativeFunctionCall.CallListIncrementOperation listVal.value");
    for (let [t3, a2] of e2.value) {
      let s2 = f.fromSerializedKey(t3);
      if (null === this._operationFuncs) return d("NativeFunctionCall._operationFuncs");
      let l2 = this._operationFuncs.get(n.Int);
      if (null === i2.value) return d("NativeFunctionCall.CallListIncrementOperation intVal.value");
      let o2 = l2(a2, i2.value), h2 = null;
      if (null === e2.value.origins) return d("NativeFunctionCall.CallListIncrementOperation listVal.value.origins");
      for (let t4 of e2.value.origins) if (t4.name == s2.originName) {
        h2 = t4;
        break;
      }
      if (null != h2) {
        let t4 = h2.TryGetItemWithValue(o2, f.Null);
        t4.exists && r2.Add(t4.result, o2);
      }
    }
    return new N(r2);
  }
  CoerceValuesToSingleType(t2) {
    let e2 = n.Int, i2 = null;
    for (let r3 of t2) {
      let t3 = s(r3, C);
      t3.valueType > e2 && (e2 = t3.valueType), t3.valueType == n.List && (i2 = a(t3, N));
    }
    let r2 = [];
    if (n[e2] == n[n.List]) for (let e3 of t2) {
      let t3 = s(e3, C);
      if (t3.valueType == n.List) r2.push(t3);
      else {
        if (t3.valueType != n.Int) {
          const e4 = n[t3.valueType];
          throw new S("Cannot mix Lists and " + e4 + " values in this operation");
        }
        {
          let e4 = parseInt(t3.valueObject);
          if (i2 = s(i2, N), null === i2.value) return d("NativeFunctionCall.CoerceValuesToSingleType specialCaseList.value");
          let n2 = i2.value.originOfMaxItem;
          if (null === n2) return d("NativeFunctionCall.CoerceValuesToSingleType list");
          let a2 = n2.TryGetItemWithValue(e4, f.Null);
          if (!a2.exists) throw new S("Could not find List item with the value " + e4 + " in " + n2.name);
          {
            let t4 = new N(a2.result, e4);
            r2.push(t4);
          }
        }
      }
    }
    else for (let n2 of t2) {
      let t3 = s(n2, C).Cast(e2);
      r2.push(t3);
    }
    return r2;
  }
  constructor() {
    if (super(), this._name = null, this._numberOfParameters = 0, this._prototype = null, this._isPrototype = false, this._operationFuncs = null, 0 === arguments.length) _R.GenerateNativeFunctionsIfNecessary();
    else if (1 === arguments.length) {
      let t2 = arguments[0];
      _R.GenerateNativeFunctionsIfNecessary(), this.name = t2;
    } else if (2 === arguments.length) {
      let t2 = arguments[0], e2 = arguments[1];
      this._isPrototype = true, this.name = t2, this.numberOfParameters = e2;
    }
  }
  static Identity(t2) {
    return t2;
  }
  static GenerateNativeFunctionsIfNecessary() {
    if (null == this._nativeFunctions) {
      this._nativeFunctions = /* @__PURE__ */ new Map(), this.AddIntBinaryOp(this.Add, ((t3, e3) => t3 + e3)), this.AddIntBinaryOp(this.Subtract, ((t3, e3) => t3 - e3)), this.AddIntBinaryOp(this.Multiply, ((t3, e3) => t3 * e3)), this.AddIntBinaryOp(this.Divide, ((t3, e3) => Math.floor(t3 / e3))), this.AddIntBinaryOp(this.Mod, ((t3, e3) => t3 % e3)), this.AddIntUnaryOp(this.Negate, ((t3) => -t3)), this.AddIntBinaryOp(this.Equal, ((t3, e3) => t3 == e3)), this.AddIntBinaryOp(this.Greater, ((t3, e3) => t3 > e3)), this.AddIntBinaryOp(this.Less, ((t3, e3) => t3 < e3)), this.AddIntBinaryOp(this.GreaterThanOrEquals, ((t3, e3) => t3 >= e3)), this.AddIntBinaryOp(this.LessThanOrEquals, ((t3, e3) => t3 <= e3)), this.AddIntBinaryOp(this.NotEquals, ((t3, e3) => t3 != e3)), this.AddIntUnaryOp(this.Not, ((t3) => 0 == t3)), this.AddIntBinaryOp(this.And, ((t3, e3) => 0 != t3 && 0 != e3)), this.AddIntBinaryOp(this.Or, ((t3, e3) => 0 != t3 || 0 != e3)), this.AddIntBinaryOp(this.Max, ((t3, e3) => Math.max(t3, e3))), this.AddIntBinaryOp(this.Min, ((t3, e3) => Math.min(t3, e3))), this.AddIntBinaryOp(this.Pow, ((t3, e3) => Math.pow(t3, e3))), this.AddIntUnaryOp(this.Floor, _R.Identity), this.AddIntUnaryOp(this.Ceiling, _R.Identity), this.AddIntUnaryOp(this.Int, _R.Identity), this.AddIntUnaryOp(this.Float, ((t3) => t3)), this.AddFloatBinaryOp(this.Add, ((t3, e3) => t3 + e3)), this.AddFloatBinaryOp(this.Subtract, ((t3, e3) => t3 - e3)), this.AddFloatBinaryOp(this.Multiply, ((t3, e3) => t3 * e3)), this.AddFloatBinaryOp(this.Divide, ((t3, e3) => t3 / e3)), this.AddFloatBinaryOp(this.Mod, ((t3, e3) => t3 % e3)), this.AddFloatUnaryOp(this.Negate, ((t3) => -t3)), this.AddFloatBinaryOp(this.Equal, ((t3, e3) => t3 == e3)), this.AddFloatBinaryOp(this.Greater, ((t3, e3) => t3 > e3)), this.AddFloatBinaryOp(this.Less, ((t3, e3) => t3 < e3)), this.AddFloatBinaryOp(this.GreaterThanOrEquals, ((t3, e3) => t3 >= e3)), this.AddFloatBinaryOp(this.LessThanOrEquals, ((t3, e3) => t3 <= e3)), this.AddFloatBinaryOp(this.NotEquals, ((t3, e3) => t3 != e3)), this.AddFloatUnaryOp(this.Not, ((t3) => 0 == t3)), this.AddFloatBinaryOp(this.And, ((t3, e3) => 0 != t3 && 0 != e3)), this.AddFloatBinaryOp(this.Or, ((t3, e3) => 0 != t3 || 0 != e3)), this.AddFloatBinaryOp(this.Max, ((t3, e3) => Math.max(t3, e3))), this.AddFloatBinaryOp(this.Min, ((t3, e3) => Math.min(t3, e3))), this.AddFloatBinaryOp(this.Pow, ((t3, e3) => Math.pow(t3, e3))), this.AddFloatUnaryOp(this.Floor, ((t3) => Math.floor(t3))), this.AddFloatUnaryOp(this.Ceiling, ((t3) => Math.ceil(t3))), this.AddFloatUnaryOp(this.Int, ((t3) => Math.floor(t3))), this.AddFloatUnaryOp(this.Float, _R.Identity), this.AddStringBinaryOp(this.Add, ((t3, e3) => t3 + e3)), this.AddStringBinaryOp(this.Equal, ((t3, e3) => t3 === e3)), this.AddStringBinaryOp(this.NotEquals, ((t3, e3) => !(t3 === e3))), this.AddStringBinaryOp(this.Has, ((t3, e3) => t3.includes(e3))), this.AddStringBinaryOp(this.Hasnt, ((t3, e3) => !t3.includes(e3))), this.AddListBinaryOp(this.Add, ((t3, e3) => t3.Union(e3))), this.AddListBinaryOp(this.Subtract, ((t3, e3) => t3.Without(e3))), this.AddListBinaryOp(this.Has, ((t3, e3) => t3.Contains(e3))), this.AddListBinaryOp(this.Hasnt, ((t3, e3) => !t3.Contains(e3))), this.AddListBinaryOp(this.Intersect, ((t3, e3) => t3.Intersect(e3))), this.AddListBinaryOp(this.Equal, ((t3, e3) => t3.Equals(e3))), this.AddListBinaryOp(this.Greater, ((t3, e3) => t3.GreaterThan(e3))), this.AddListBinaryOp(this.Less, ((t3, e3) => t3.LessThan(e3))), this.AddListBinaryOp(this.GreaterThanOrEquals, ((t3, e3) => t3.GreaterThanOrEquals(e3))), this.AddListBinaryOp(this.LessThanOrEquals, ((t3, e3) => t3.LessThanOrEquals(e3))), this.AddListBinaryOp(this.NotEquals, ((t3, e3) => !t3.Equals(e3))), this.AddListBinaryOp(this.And, ((t3, e3) => t3.Count > 0 && e3.Count > 0)), this.AddListBinaryOp(this.Or, ((t3, e3) => t3.Count > 0 || e3.Count > 0)), this.AddListUnaryOp(this.Not, ((t3) => 0 == t3.Count ? 1 : 0)), this.AddListUnaryOp(this.Invert, ((t3) => t3.inverse)), this.AddListUnaryOp(this.All, ((t3) => t3.all)), this.AddListUnaryOp(this.ListMin, ((t3) => t3.MinAsList())), this.AddListUnaryOp(this.ListMax, ((t3) => t3.MaxAsList())), this.AddListUnaryOp(this.Count, ((t3) => t3.Count)), this.AddListUnaryOp(this.ValueOfList, ((t3) => t3.maxItem.Value));
      let t2 = (t3, e3) => t3.Equals(e3), e2 = (t3, e3) => !t3.Equals(e3);
      this.AddOpToNativeFunc(this.Equal, 2, n.DivertTarget, t2), this.AddOpToNativeFunc(this.NotEquals, 2, n.DivertTarget, e2);
    }
  }
  AddOpFuncForType(t2, e2) {
    null == this._operationFuncs && (this._operationFuncs = /* @__PURE__ */ new Map()), this._operationFuncs.set(t2, e2);
  }
  static AddOpToNativeFunc(t2, e2, n2, i2) {
    if (null === this._nativeFunctions) return d("NativeFunctionCall._nativeFunctions");
    let r2 = this._nativeFunctions.get(t2);
    r2 || (r2 = new _R(t2, e2), this._nativeFunctions.set(t2, r2)), r2.AddOpFuncForType(n2, i2);
  }
  static AddIntBinaryOp(t2, e2) {
    this.AddOpToNativeFunc(t2, 2, n.Int, e2);
  }
  static AddIntUnaryOp(t2, e2) {
    this.AddOpToNativeFunc(t2, 1, n.Int, e2);
  }
  static AddFloatBinaryOp(t2, e2) {
    this.AddOpToNativeFunc(t2, 2, n.Float, e2);
  }
  static AddFloatUnaryOp(t2, e2) {
    this.AddOpToNativeFunc(t2, 1, n.Float, e2);
  }
  static AddStringBinaryOp(t2, e2) {
    this.AddOpToNativeFunc(t2, 2, n.String, e2);
  }
  static AddListBinaryOp(t2, e2) {
    this.AddOpToNativeFunc(t2, 2, n.List, e2);
  }
  static AddListUnaryOp(t2, e2) {
    this.AddOpToNativeFunc(t2, 1, n.List, e2);
  }
  toString() {
    return 'Native "' + this.name + '"';
  }
};
R.Add = "+", R.Subtract = "-", R.Divide = "/", R.Multiply = "*", R.Mod = "%", R.Negate = "_", R.Equal = "==", R.Greater = ">", R.Less = "<", R.GreaterThanOrEquals = ">=", R.LessThanOrEquals = "<=", R.NotEquals = "!=", R.Not = "!", R.And = "&&", R.Or = "||", R.Min = "MIN", R.Max = "MAX", R.Pow = "POW", R.Floor = "FLOOR", R.Ceiling = "CEILING", R.Int = "INT", R.Float = "FLOAT", R.Has = "?", R.Hasnt = "!?", R.Intersect = "^", R.ListMin = "LIST_MIN", R.ListMax = "LIST_MAX", R.All = "LIST_ALL", R.Count = "LIST_COUNT", R.ValueOfList = "LIST_VALUE", R.Invert = "LIST_INVERT", R._nativeFunctions = null;
var j = class extends p {
  constructor(t2) {
    super(), this.text = t2.toString() || "";
  }
  toString() {
    return "# " + this.text;
  }
};
var B = class _B extends p {
  constructor() {
    super(...arguments), this.text = "", this.index = 0, this.threadAtGeneration = null, this.sourcePath = "", this.targetPath = null, this.isInvisibleDefault = false, this.tags = null, this.originalThreadIndex = 0;
  }
  get pathStringOnChoice() {
    return null === this.targetPath ? d("Choice.targetPath") : this.targetPath.toString();
  }
  set pathStringOnChoice(e2) {
    this.targetPath = new t(e2);
  }
  Clone() {
    let t2 = new _B();
    return t2.text = this.text, t2.sourcePath = this.sourcePath, t2.index = this.index, t2.targetPath = this.targetPath, t2.originalThreadIndex = this.originalThreadIndex, t2.isInvisibleDefault = this.isInvisibleDefault, null !== this.threadAtGeneration && (t2.threadAtGeneration = this.threadAtGeneration.Copy()), t2;
  }
};
var G = class {
  constructor(t2, e2) {
    this._name = t2 || "", this._items = null, this._itemNameToValues = e2 || /* @__PURE__ */ new Map();
  }
  get name() {
    return this._name;
  }
  get items() {
    if (null == this._items) {
      this._items = /* @__PURE__ */ new Map();
      for (let [t2, e2] of this._itemNameToValues) {
        let n2 = new f(this.name, t2);
        this._items.set(n2.serialized(), e2);
      }
    }
    return this._items;
  }
  ValueForItem(t2) {
    if (!t2.itemName) return 0;
    let e2 = this._itemNameToValues.get(t2.itemName);
    return void 0 !== e2 ? e2 : 0;
  }
  ContainsItem(t2) {
    return !!t2.itemName && (t2.originName == this.name && this._itemNameToValues.has(t2.itemName));
  }
  ContainsItemWithName(t2) {
    return this._itemNameToValues.has(t2);
  }
  TryGetItemWithValue(t2, e2) {
    for (let [e3, n2] of this._itemNameToValues) if (n2 == t2) return { result: new f(this.name, e3), exists: true };
    return { result: f.Null, exists: false };
  }
  TryGetValueForItem(t2, e2) {
    if (!t2.itemName) return { result: 0, exists: false };
    let n2 = this._itemNameToValues.get(t2.itemName);
    return n2 ? { result: n2, exists: true } : { result: 0, exists: false };
  }
};
var M = class {
  constructor(t2) {
    this._lists = /* @__PURE__ */ new Map(), this._allUnambiguousListValueCache = /* @__PURE__ */ new Map();
    for (let e2 of t2) {
      this._lists.set(e2.name, e2);
      for (let [t3, n2] of e2.items) {
        let e3 = f.fromSerializedKey(t3), i2 = new N(e3, n2);
        if (!e3.itemName) throw new Error("item.itemName is null or undefined.");
        this._allUnambiguousListValueCache.set(e3.itemName, i2), this._allUnambiguousListValueCache.set(e3.fullName, i2);
      }
    }
  }
  get lists() {
    let t2 = [];
    for (let [, e2] of this._lists) t2.push(e2);
    return t2;
  }
  TryListGetDefinition(t2, e2) {
    if (null === t2) return { result: e2, exists: false };
    let n2 = this._lists.get(t2);
    return n2 ? { result: n2, exists: true } : { result: e2, exists: false };
  }
  FindSingleItemListWithName(t2) {
    if (null === t2) return d("name");
    let e2 = this._allUnambiguousListValueCache.get(t2);
    return void 0 !== e2 ? e2 : null;
  }
};
var J = class _J {
  static JArrayToRuntimeObjList(t2) {
    let e2 = arguments.length > 1 && void 0 !== arguments[1] && arguments[1], n2 = t2.length;
    e2 && n2--;
    let i2 = [];
    for (let e3 = 0; e3 < n2; e3++) {
      let n3 = t2[e3], r2 = this.JTokenToRuntimeObject(n3);
      if (null === r2) return d("runtimeObj");
      i2.push(r2);
    }
    return i2;
  }
  static WriteDictionaryRuntimeObjs(t2, e2) {
    t2.WriteObjectStart();
    for (let [n2, i2] of e2) t2.WritePropertyStart(n2), this.WriteRuntimeObject(t2, i2), t2.WritePropertyEnd();
    t2.WriteObjectEnd();
  }
  static WriteListRuntimeObjs(t2, e2) {
    t2.WriteArrayStart();
    for (let n2 of e2) this.WriteRuntimeObject(t2, n2);
    t2.WriteArrayEnd();
  }
  static WriteIntDictionary(t2, e2) {
    t2.WriteObjectStart();
    for (let [n2, i2] of e2) t2.WriteIntProperty(n2, i2);
    t2.WriteObjectEnd();
  }
  static WriteRuntimeObject(t2, e2) {
    let n2 = a(e2, A);
    if (n2) return void this.WriteRuntimeContainer(t2, n2);
    let r2 = a(e2, F);
    if (r2) {
      let e3, n3 = "->";
      return r2.isExternal ? n3 = "x()" : r2.pushesToStack && (r2.stackPushType == i.Function ? n3 = "f()" : r2.stackPushType == i.Tunnel && (n3 = "->t->")), e3 = r2.hasVariableTarget ? r2.variableDivertName : r2.targetPathString, t2.WriteObjectStart(), t2.WriteProperty(n3, e3), r2.hasVariableTarget && t2.WriteProperty("var", true), r2.isConditional && t2.WriteProperty("c", true), r2.externalArgs > 0 && t2.WriteIntProperty("exArgs", r2.externalArgs), void t2.WriteObjectEnd();
    }
    let s2 = a(e2, W);
    if (s2) return t2.WriteObjectStart(), t2.WriteProperty("*", s2.pathStringOnChoice), t2.WriteIntProperty("flg", s2.flags), void t2.WriteObjectEnd();
    let l2 = a(e2, b);
    if (l2) return void t2.WriteBool(l2.value);
    let o2 = a(e2, _);
    if (o2) return void t2.WriteInt(o2.value);
    let h2 = a(e2, w);
    if (h2) return void t2.WriteFloat(h2.value);
    let u2 = a(e2, T);
    if (u2) return void (u2.isNewline ? t2.Write("\n", false) : (t2.WriteStringStart(), t2.WriteStringInner("^"), t2.WriteStringInner(u2.value), t2.WriteStringEnd()));
    let c2 = a(e2, N);
    if (c2) return void this.WriteInkList(t2, c2);
    let p2 = a(e2, E);
    if (p2) return t2.WriteObjectStart(), null === p2.value ? d("divTargetVal.value") : (t2.WriteProperty("^->", p2.value.componentsString), void t2.WriteObjectEnd());
    let m2 = a(e2, P);
    if (m2) return t2.WriteObjectStart(), t2.WriteProperty("^var", m2.value), t2.WriteIntProperty("ci", m2.contextIndex), void t2.WriteObjectEnd();
    if (a(e2, x)) return void t2.Write("<>");
    let f2 = a(e2, I);
    if (f2) return void t2.Write(_J._controlCommandNames[f2.commandType]);
    let g2 = a(e2, R);
    if (g2) {
      let e3 = g2.name;
      return "^" == e3 && (e3 = "L^"), void t2.Write(e3);
    }
    let S2 = a(e2, V);
    if (S2) {
      t2.WriteObjectStart();
      let e3 = S2.pathStringForCount;
      return null != e3 ? t2.WriteProperty("CNT?", e3) : t2.WriteProperty("VAR?", S2.name), void t2.WriteObjectEnd();
    }
    let y2 = a(e2, L);
    if (y2) {
      t2.WriteObjectStart();
      let e3 = y2.isGlobal ? "VAR=" : "temp=";
      return t2.WriteProperty(e3, y2.variableName), y2.isNewDeclaration || t2.WriteProperty("re", true), void t2.WriteObjectEnd();
    }
    if (a(e2, D)) return void t2.Write("void");
    let v2 = a(e2, j);
    if (v2) return t2.WriteObjectStart(), t2.WriteProperty("#", v2.text), void t2.WriteObjectEnd();
    let C2 = a(e2, B);
    if (!C2) throw new Error("Failed to convert runtime object to Json token: " + e2);
    this.WriteChoice(t2, C2);
  }
  static JObjectToDictionaryRuntimeObjs(t2) {
    let e2 = /* @__PURE__ */ new Map();
    for (let n2 in t2) if (t2.hasOwnProperty(n2)) {
      let i2 = this.JTokenToRuntimeObject(t2[n2]);
      if (null === i2) return d("inkObject");
      e2.set(n2, i2);
    }
    return e2;
  }
  static JObjectToIntDictionary(t2) {
    let e2 = /* @__PURE__ */ new Map();
    for (let n2 in t2) t2.hasOwnProperty(n2) && e2.set(n2, parseInt(t2[n2]));
    return e2;
  }
  static JTokenToRuntimeObject(e2) {
    if ("number" == typeof e2 && !isNaN(e2) || "boolean" == typeof e2) return C.Create(e2);
    if ("string" == typeof e2) {
      let t2 = e2.toString();
      const n2 = /^([0-9]+.[0-9]+f)$/.exec(t2);
      if (n2) return new w(parseFloat(n2[0]));
      let i2 = t2[0];
      if ("^" == i2) return new T(t2.substring(1));
      if ("\n" == i2 && 1 == t2.length) return new T("\n");
      if ("<>" == t2) return new x();
      for (let e3 = 0; e3 < _J._controlCommandNames.length; ++e3) {
        if (t2 == _J._controlCommandNames[e3]) return new I(e3);
      }
      if ("L^" == t2 && (t2 = "^"), R.CallExistsWithName(t2)) return R.CallWithName(t2);
      if ("->->" == t2) return I.PopTunnel();
      if ("~ret" == t2) return I.PopFunction();
      if ("void" == t2) return new D();
    }
    if ("object" == typeof e2 && !Array.isArray(e2)) {
      let n2, r2 = e2;
      if (r2["^->"]) return n2 = r2["^->"], new E(new t(n2.toString()));
      if (r2["^var"]) {
        n2 = r2["^var"];
        let t2 = new P(n2.toString());
        return "ci" in r2 && (n2 = r2.ci, t2.contextIndex = parseInt(n2)), t2;
      }
      let a2 = false, s2 = false, l2 = i.Function, o2 = false;
      if ((n2 = r2["->"]) ? a2 = true : (n2 = r2["f()"]) ? (a2 = true, s2 = true, l2 = i.Function) : (n2 = r2["->t->"]) ? (a2 = true, s2 = true, l2 = i.Tunnel) : (n2 = r2["x()"]) && (a2 = true, o2 = true, s2 = false, l2 = i.Function), a2) {
        let t2 = new F();
        t2.pushesToStack = s2, t2.stackPushType = l2, t2.isExternal = o2;
        let e3 = n2.toString();
        return (n2 = r2.var) ? t2.variableDivertName = e3 : t2.targetPathString = e3, t2.isConditional = !!r2.c, o2 && (n2 = r2.exArgs) && (t2.externalArgs = parseInt(n2)), t2;
      }
      if (n2 = r2["*"]) {
        let t2 = new W();
        return t2.pathStringOnChoice = n2.toString(), (n2 = r2.flg) && (t2.flags = parseInt(n2)), t2;
      }
      if (n2 = r2["VAR?"]) return new V(n2.toString());
      if (n2 = r2["CNT?"]) {
        let t2 = new V();
        return t2.pathStringForCount = n2.toString(), t2;
      }
      let h2 = false, u2 = false;
      if ((n2 = r2["VAR="]) ? (h2 = true, u2 = true) : (n2 = r2["temp="]) && (h2 = true, u2 = false), h2) {
        let t2 = n2.toString(), e3 = !r2.re, i2 = new L(t2, e3);
        return i2.isGlobal = u2, i2;
      }
      if (void 0 !== r2["#"]) return n2 = r2["#"], new j(n2.toString());
      if (n2 = r2.list) {
        let t2 = n2, e3 = new g();
        if (n2 = r2.origins) {
          let t3 = n2;
          e3.SetInitialOriginNames(t3);
        }
        for (let n3 in t2) if (t2.hasOwnProperty(n3)) {
          let i2 = t2[n3], r3 = new f(n3), a3 = parseInt(i2);
          e3.Add(r3, a3);
        }
        return new N(e3);
      }
      if (null != r2.originalChoicePath) return this.JObjectToChoice(r2);
    }
    if (Array.isArray(e2)) return this.JArrayToContainer(e2);
    if (null == e2) return null;
    throw new Error("Failed to convert token to runtime object: " + this.toJson(e2, ["parent"]));
  }
  static toJson(t2, e2, n2) {
    return JSON.stringify(t2, ((t3, n3) => (null == e2 ? void 0 : e2.some(((e3) => e3 === t3))) ? void 0 : n3), n2);
  }
  static WriteRuntimeContainer(t2, e2) {
    let n2 = arguments.length > 2 && void 0 !== arguments[2] && arguments[2];
    if (t2.WriteArrayStart(), null === e2) return d("container");
    for (let n3 of e2.content) this.WriteRuntimeObject(t2, n3);
    let i2 = e2.namedOnlyContent, r2 = e2.countFlags, s2 = null != e2.name && !n2, l2 = null != i2 || r2 > 0 || s2;
    if (l2 && t2.WriteObjectStart(), null != i2) for (let [e3, n3] of i2) {
      let i3 = e3, r3 = a(n3, A);
      t2.WritePropertyStart(i3), this.WriteRuntimeContainer(t2, r3, true), t2.WritePropertyEnd();
    }
    r2 > 0 && t2.WriteIntProperty("#f", r2), s2 && t2.WriteProperty("#n", e2.name), l2 ? t2.WriteObjectEnd() : t2.WriteNull(), t2.WriteArrayEnd();
  }
  static JArrayToContainer(t2) {
    let e2 = new A();
    e2.content = this.JArrayToRuntimeObjList(t2, true);
    let n2 = t2[t2.length - 1];
    if (null != n2) {
      let t3 = /* @__PURE__ */ new Map();
      for (let i2 in n2) if ("#f" == i2) e2.countFlags = parseInt(n2[i2]);
      else if ("#n" == i2) e2.name = n2[i2].toString();
      else {
        let e3 = this.JTokenToRuntimeObject(n2[i2]), r2 = a(e3, A);
        r2 && (r2.name = i2), t3.set(i2, e3);
      }
      e2.namedOnlyContent = t3;
    }
    return e2;
  }
  static JObjectToChoice(t2) {
    let e2 = new B();
    return e2.text = t2.text.toString(), e2.index = parseInt(t2.index), e2.sourcePath = t2.originalChoicePath.toString(), e2.originalThreadIndex = parseInt(t2.originalThreadIndex), e2.pathStringOnChoice = t2.targetPath.toString(), e2.tags = this.JArrayToTags(t2), e2.isInvisibleDefault = !!t2.isInvisibleDefault, e2;
  }
  static JArrayToTags(t2) {
    return t2.tags ? t2.tags : null;
  }
  static WriteChoice(t2, e2) {
    t2.WriteObjectStart(), t2.WriteProperty("text", e2.text), t2.WriteIntProperty("index", e2.index), t2.WriteProperty("originalChoicePath", e2.sourcePath), t2.WriteIntProperty("originalThreadIndex", e2.originalThreadIndex), t2.WriteProperty("targetPath", e2.pathStringOnChoice), t2.WriteProperty("isInvisibleDefault", e2.isInvisibleDefault), this.WriteChoiceTags(t2, e2), t2.WriteObjectEnd();
  }
  static WriteChoiceTags(t2, e2) {
    if (e2.tags && e2.tags.length > 0) {
      t2.WritePropertyStart("tags"), t2.WriteArrayStart();
      for (const n2 of e2.tags) t2.Write(n2);
      t2.WriteArrayEnd(), t2.WritePropertyEnd();
    }
  }
  static WriteInkList(t2, e2) {
    let n2 = e2.value;
    if (null === n2) return d("rawList");
    t2.WriteObjectStart(), t2.WritePropertyStart("list"), t2.WriteObjectStart();
    for (let [e3, i2] of n2) {
      let n3 = f.fromSerializedKey(e3), r2 = i2;
      if (null === n3.itemName) return d("item.itemName");
      t2.WritePropertyNameStart(), t2.WritePropertyNameInner(n3.originName ? n3.originName : "?"), t2.WritePropertyNameInner("."), t2.WritePropertyNameInner(n3.itemName), t2.WritePropertyNameEnd(), t2.Write(r2), t2.WritePropertyEnd();
    }
    if (t2.WriteObjectEnd(), t2.WritePropertyEnd(), 0 == n2.Count && null != n2.originNames && n2.originNames.length > 0) {
      t2.WritePropertyStart("origins"), t2.WriteArrayStart();
      for (let e3 of n2.originNames) t2.Write(e3);
      t2.WriteArrayEnd(), t2.WritePropertyEnd();
    }
    t2.WriteObjectEnd();
  }
  static ListDefinitionsToJToken(t2) {
    let e2 = {};
    for (let n2 of t2.lists) {
      let t3 = {};
      for (let [e3, i2] of n2.items) {
        let n3 = f.fromSerializedKey(e3);
        if (null === n3.itemName) return d("item.itemName");
        t3[n3.itemName] = i2;
      }
      e2[n2.name] = t3;
    }
    return e2;
  }
  static JTokenToListDefinitions(t2) {
    let e2 = t2, n2 = [];
    for (let t3 in e2) if (e2.hasOwnProperty(t3)) {
      let i2 = t3.toString(), r2 = e2[t3], a2 = /* @__PURE__ */ new Map();
      for (let n3 in r2) if (e2.hasOwnProperty(t3)) {
        let t4 = r2[n3];
        a2.set(n3, parseInt(t4));
      }
      let s2 = new G(i2, a2);
      n2.push(s2);
    }
    return new M(n2);
  }
};
J._controlCommandNames = (() => {
  let t2 = [];
  t2[I.CommandType.EvalStart] = "ev", t2[I.CommandType.EvalOutput] = "out", t2[I.CommandType.EvalEnd] = "/ev", t2[I.CommandType.Duplicate] = "du", t2[I.CommandType.PopEvaluatedValue] = "pop", t2[I.CommandType.PopFunction] = "~ret", t2[I.CommandType.PopTunnel] = "->->", t2[I.CommandType.BeginString] = "str", t2[I.CommandType.EndString] = "/str", t2[I.CommandType.NoOp] = "nop", t2[I.CommandType.ChoiceCount] = "choiceCnt", t2[I.CommandType.Turns] = "turn", t2[I.CommandType.TurnsSince] = "turns", t2[I.CommandType.ReadCount] = "readc", t2[I.CommandType.Random] = "rnd", t2[I.CommandType.SeedRandom] = "srnd", t2[I.CommandType.VisitIndex] = "visit", t2[I.CommandType.SequenceShuffleIndex] = "seq", t2[I.CommandType.StartThread] = "thread", t2[I.CommandType.Done] = "done", t2[I.CommandType.End] = "end", t2[I.CommandType.ListFromInt] = "listInt", t2[I.CommandType.ListRange] = "range", t2[I.CommandType.ListRandom] = "lrnd", t2[I.CommandType.BeginTag] = "#", t2[I.CommandType.EndTag] = "/#";
  for (let e2 = 0; e2 < I.CommandType.TOTAL_VALUES; ++e2) if (null == t2[e2]) throw new Error("Control command not accounted for in serialisation");
  return t2;
})();
var q = class _q {
  get elements() {
    return this.callStack;
  }
  get depth() {
    return this.elements.length;
  }
  get currentElement() {
    let t2 = this._threads[this._threads.length - 1].callstack;
    return t2[t2.length - 1];
  }
  get currentElementIndex() {
    return this.callStack.length - 1;
  }
  get currentThread() {
    return this._threads[this._threads.length - 1];
  }
  set currentThread(t2) {
    e.Assert(1 == this._threads.length, "Shouldn't be directly setting the current thread when we have a stack of them"), this._threads.length = 0, this._threads.push(t2);
  }
  get canPop() {
    return this.callStack.length > 1;
  }
  constructor() {
    if (this._threadCounter = 0, this._startOfRoot = k.Null, arguments[0] instanceof Q) {
      let t2 = arguments[0];
      this._startOfRoot = k.StartOf(t2.rootContentContainer), this.Reset();
    } else {
      let t2 = arguments[0];
      this._threads = [];
      for (let e2 of t2._threads) this._threads.push(e2.Copy());
      this._threadCounter = t2._threadCounter, this._startOfRoot = t2._startOfRoot.copy();
    }
  }
  Reset() {
    this._threads = [], this._threads.push(new _q.Thread()), this._threads[0].callstack.push(new _q.Element(i.Tunnel, this._startOfRoot));
  }
  SetJsonToken(t2, e2) {
    this._threads.length = 0;
    let n2 = t2.threads;
    for (let t3 of n2) {
      let n3 = t3, i2 = new _q.Thread(n3, e2);
      this._threads.push(i2);
    }
    this._threadCounter = parseInt(t2.threadCounter), this._startOfRoot = k.StartOf(e2.rootContentContainer);
  }
  WriteJson(t2) {
    t2.WriteObject(((t3) => {
      t3.WritePropertyStart("threads"), t3.WriteArrayStart();
      for (let e2 of this._threads) e2.WriteJson(t3);
      t3.WriteArrayEnd(), t3.WritePropertyEnd(), t3.WritePropertyStart("threadCounter"), t3.WriteInt(this._threadCounter), t3.WritePropertyEnd();
    }));
  }
  PushThread() {
    let t2 = this.currentThread.Copy();
    this._threadCounter++, t2.threadIndex = this._threadCounter, this._threads.push(t2);
  }
  ForkThread() {
    let t2 = this.currentThread.Copy();
    return this._threadCounter++, t2.threadIndex = this._threadCounter, t2;
  }
  PopThread() {
    if (!this.canPopThread) throw new Error("Can't pop thread");
    this._threads.splice(this._threads.indexOf(this.currentThread), 1);
  }
  get canPopThread() {
    return this._threads.length > 1 && !this.elementIsEvaluateFromGame;
  }
  get elementIsEvaluateFromGame() {
    return this.currentElement.type == i.FunctionEvaluationFromGame;
  }
  Push(t2) {
    let e2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : 0, n2 = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : 0, i2 = new _q.Element(t2, this.currentElement.currentPointer, false);
    i2.evaluationStackHeightWhenPushed = e2, i2.functionStartInOutputStream = n2, this.callStack.push(i2);
  }
  CanPop() {
    let t2 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : null;
    return !!this.canPop && (null == t2 || this.currentElement.type == t2);
  }
  Pop() {
    let t2 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : null;
    if (!this.CanPop(t2)) throw new Error("Mismatched push/pop in Callstack");
    this.callStack.pop();
  }
  GetTemporaryVariableWithName(t2) {
    let e2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : -1;
    -1 == e2 && (e2 = this.currentElementIndex + 1);
    let n2 = y(this.callStack[e2 - 1].temporaryVariables, t2, null);
    return n2.exists ? n2.result : null;
  }
  SetTemporaryVariable(t2, e2, n2) {
    let i2 = arguments.length > 3 && void 0 !== arguments[3] ? arguments[3] : -1;
    -1 == i2 && (i2 = this.currentElementIndex + 1);
    let r2 = this.callStack[i2 - 1];
    if (!n2 && !r2.temporaryVariables.get(t2)) throw new Error("Could not find temporary variable to set: " + t2);
    let a2 = y(r2.temporaryVariables, t2, null);
    a2.exists && N.RetainListOriginsForAssignment(a2.result, e2), r2.temporaryVariables.set(t2, e2);
  }
  ContextForVariableNamed(t2) {
    return this.currentElement.temporaryVariables.get(t2) ? this.currentElementIndex + 1 : 0;
  }
  ThreadWithIndex(t2) {
    let e2 = this._threads.filter(((e3) => {
      if (e3.threadIndex == t2) return e3;
    }));
    return e2.length > 0 ? e2[0] : null;
  }
  get callStack() {
    return this.currentThread.callstack;
  }
  get callStackTrace() {
    let t2 = new m();
    for (let e2 = 0; e2 < this._threads.length; e2++) {
      let n2 = this._threads[e2], r2 = e2 == this._threads.length - 1;
      t2.AppendFormat("=== THREAD {0}/{1} {2}===\n", e2 + 1, this._threads.length, r2 ? "(current) " : "");
      for (let e3 = 0; e3 < n2.callstack.length; e3++) {
        n2.callstack[e3].type == i.Function ? t2.Append("  [FUNCTION] ") : t2.Append("  [TUNNEL] ");
        let r3 = n2.callstack[e3].currentPointer;
        if (!r3.isNull) {
          if (t2.Append("<SOMEWHERE IN "), null === r3.container) return d("pointer.container");
          t2.Append(r3.container.path.toString()), t2.AppendLine(">");
        }
      }
    }
    return t2.toString();
  }
};
!(function(e2) {
  class n2 {
    constructor(t2, e3) {
      let n3 = arguments.length > 2 && void 0 !== arguments[2] && arguments[2];
      this.evaluationStackHeightWhenPushed = 0, this.functionStartInOutputStream = 0, this.currentPointer = e3.copy(), this.inExpressionEvaluation = n3, this.temporaryVariables = /* @__PURE__ */ new Map(), this.type = t2;
    }
    Copy() {
      let t2 = new n2(this.type, this.currentPointer, this.inExpressionEvaluation);
      return t2.temporaryVariables = new Map(this.temporaryVariables), t2.evaluationStackHeightWhenPushed = this.evaluationStackHeightWhenPushed, t2.functionStartInOutputStream = this.functionStartInOutputStream, t2;
    }
  }
  e2.Element = n2;
  class i2 {
    constructor() {
      if (this.threadIndex = 0, this.previousPointer = k.Null, this.callstack = [], arguments[0] && arguments[1]) {
        let e3 = arguments[0], i3 = arguments[1];
        this.threadIndex = parseInt(e3.threadIndex);
        let r2 = e3.callstack;
        for (let e4 of r2) {
          let r3, a3 = e4, s2 = parseInt(a3.type), l2 = k.Null, o2 = a3.cPath;
          if (void 0 !== o2) {
            r3 = o2.toString();
            let e5 = i3.ContentAtPath(new t(r3));
            if (l2.container = e5.container, l2.index = parseInt(a3.idx), null == e5.obj) throw new Error("When loading state, internal story location couldn't be found: " + r3 + ". Has the story changed since this save data was created?");
            e5.approximate && (null !== l2.container ? i3.Warning("When loading state, exact internal story location couldn't be found: '" + r3 + "', so it was approximated to '" + l2.container.path.toString() + "' to recover. Has the story changed since this save data was created?") : i3.Warning("When loading state, exact internal story location couldn't be found: '" + r3 + "' and it may not be recoverable. Has the story changed since this save data was created?"));
          }
          let h2 = !!a3.exp, u2 = new n2(s2, l2, h2), c2 = a3.temp;
          void 0 !== c2 ? u2.temporaryVariables = J.JObjectToDictionaryRuntimeObjs(c2) : u2.temporaryVariables.clear(), this.callstack.push(u2);
        }
        let a2 = e3.previousContentObject;
        if (void 0 !== a2) {
          let e4 = new t(a2.toString());
          this.previousPointer = i3.PointerAtPath(e4);
        }
      }
    }
    Copy() {
      let t2 = new i2();
      t2.threadIndex = this.threadIndex;
      for (let e3 of this.callstack) t2.callstack.push(e3.Copy());
      return t2.previousPointer = this.previousPointer.copy(), t2;
    }
    WriteJson(t2) {
      t2.WriteObjectStart(), t2.WritePropertyStart("callstack"), t2.WriteArrayStart();
      for (let e3 of this.callstack) {
        if (t2.WriteObjectStart(), !e3.currentPointer.isNull) {
          if (null === e3.currentPointer.container) return d("el.currentPointer.container");
          t2.WriteProperty("cPath", e3.currentPointer.container.path.componentsString), t2.WriteIntProperty("idx", e3.currentPointer.index);
        }
        t2.WriteProperty("exp", e3.inExpressionEvaluation), t2.WriteIntProperty("type", e3.type), e3.temporaryVariables.size > 0 && (t2.WritePropertyStart("temp"), J.WriteDictionaryRuntimeObjs(t2, e3.temporaryVariables), t2.WritePropertyEnd()), t2.WriteObjectEnd();
      }
      if (t2.WriteArrayEnd(), t2.WritePropertyEnd(), t2.WriteIntProperty("threadIndex", this.threadIndex), !this.previousPointer.isNull) {
        let e3 = this.previousPointer.Resolve();
        if (null === e3) return d("this.previousPointer.Resolve()");
        t2.WriteProperty("previousContentObject", e3.path.toString());
      }
      t2.WriteObjectEnd();
    }
  }
  e2.Thread = i2;
})(q || (q = {}));
var U = class _U extends class {
} {
  variableChangedEvent(t2, e2) {
    for (let n2 of this.variableChangedEventCallbacks) n2(t2, e2);
  }
  StartVariableObservation() {
    this._batchObservingVariableChanges = true, this._changedVariablesForBatchObs = /* @__PURE__ */ new Set();
  }
  CompleteVariableObservation() {
    this._batchObservingVariableChanges = false;
    let t2 = /* @__PURE__ */ new Map();
    if (null != this._changedVariablesForBatchObs) for (let t3 of this._changedVariablesForBatchObs) {
      let e2 = this._globalVariables.get(t3);
      this.variableChangedEvent(t3, e2);
    }
    if (null != this.patch) for (let e2 of this.patch.changedVariables) {
      let n2 = this.patch.TryGetGlobal(e2, null);
      n2.exists && t2.set(e2, n2);
    }
    return this._changedVariablesForBatchObs = null, t2;
  }
  NotifyObservers(t2) {
    for (const [e2, n2] of t2) this.variableChangedEvent(e2, n2);
  }
  get callStack() {
    return this._callStack;
  }
  set callStack(t2) {
    this._callStack = t2;
  }
  $(t2, e2) {
    if (void 0 === e2) {
      let e3 = null;
      return null !== this.patch && (e3 = this.patch.TryGetGlobal(t2, null), e3.exists) ? e3.result.valueObject : (e3 = this._globalVariables.get(t2), void 0 === e3 && (e3 = this._defaultGlobalVariables.get(t2)), void 0 !== e3 ? e3.valueObject : null);
    }
    {
      if (void 0 === this._defaultGlobalVariables.get(t2)) throw new S("Cannot assign to a variable (" + t2 + ") that hasn't been declared in the story");
      let n2 = C.Create(e2);
      if (null == n2) throw null == e2 ? new Error("Cannot pass null to VariableState") : new Error("Invalid value passed to VariableState: " + e2.toString());
      this.SetGlobal(t2, n2);
    }
  }
  constructor(t2, e2) {
    super(), this.variableChangedEventCallbacks = [], this.patch = null, this._defaultGlobalVariables = /* @__PURE__ */ new Map(), this._changedVariablesForBatchObs = /* @__PURE__ */ new Set(), this._batchObservingVariableChanges = false, this._globalVariables = /* @__PURE__ */ new Map(), this._callStack = t2, this._listDefsOrigin = e2;
    try {
      return new Proxy(this, { get: (t3, e3) => e3 in t3 ? t3[e3] : t3.$(e3), set: (t3, e3, n2) => (e3 in t3 ? t3[e3] = n2 : t3.$(e3, n2), true), ownKeys: (t3) => [.../* @__PURE__ */ new Set([...t3._defaultGlobalVariables.keys(), ...t3._globalVariables.keys()])], getOwnPropertyDescriptor: (t3, e3) => ({ enumerable: true, configurable: true, value: t3.$(e3) }) });
    } catch (t3) {
    }
  }
  ApplyPatch() {
    if (null === this.patch) return d("this.patch");
    for (let [t2, e2] of this.patch.globals) this._globalVariables.set(t2, e2);
    if (null !== this._changedVariablesForBatchObs) for (let t2 of this.patch.changedVariables) this._changedVariablesForBatchObs.add(t2);
    this.patch = null;
  }
  SetJsonToken(t2) {
    this._globalVariables.clear();
    for (let [e2, n2] of this._defaultGlobalVariables) {
      let i2 = t2[e2];
      if (void 0 !== i2) {
        let t3 = J.JTokenToRuntimeObject(i2);
        if (null === t3) return d("tokenInkObject");
        this._globalVariables.set(e2, t3);
      } else this._globalVariables.set(e2, n2);
    }
  }
  WriteJson(t2) {
    t2.WriteObjectStart();
    for (let [e2, n2] of this._globalVariables) {
      let i2 = e2, r2 = n2;
      if (_U.dontSaveDefaultValues && this._defaultGlobalVariables.has(i2)) {
        let t3 = this._defaultGlobalVariables.get(i2);
        if (this.RuntimeObjectsEqual(r2, t3)) continue;
      }
      t2.WritePropertyStart(i2), J.WriteRuntimeObject(t2, r2), t2.WritePropertyEnd();
    }
    t2.WriteObjectEnd();
  }
  RuntimeObjectsEqual(t2, e2) {
    if (null === t2) return d("obj1");
    if (null === e2) return d("obj2");
    if (t2.constructor !== e2.constructor) return false;
    let n2 = a(t2, b);
    if (null !== n2) return n2.value === s(e2, b).value;
    let i2 = a(t2, _);
    if (null !== i2) return i2.value === s(e2, _).value;
    let r2 = a(t2, w);
    if (null !== r2) return r2.value === s(e2, w).value;
    let l2 = a(t2, C), o2 = a(e2, C);
    if (null !== l2 && null !== o2) return h(l2.valueObject) && h(o2.valueObject) ? l2.valueObject.Equals(o2.valueObject) : l2.valueObject === o2.valueObject;
    throw new Error("FastRoughDefinitelyEquals: Unsupported runtime object type: " + t2.constructor.name);
  }
  GetVariableWithName(t2) {
    let e2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : -1, n2 = this.GetRawVariableWithName(t2, e2), i2 = a(n2, P);
    return null !== i2 && (n2 = this.ValueAtVariablePointer(i2)), n2;
  }
  TryGetDefaultVariableValue(t2) {
    let e2 = y(this._defaultGlobalVariables, t2, null);
    return e2.exists ? e2.result : null;
  }
  GlobalVariableExistsWithName(t2) {
    return this._globalVariables.has(t2) || null !== this._defaultGlobalVariables && this._defaultGlobalVariables.has(t2);
  }
  GetRawVariableWithName(t2, e2) {
    let n2 = null;
    if (0 == e2 || -1 == e2) {
      let e3 = null;
      if (null !== this.patch && (e3 = this.patch.TryGetGlobal(t2, null), e3.exists)) return e3.result;
      if (e3 = y(this._globalVariables, t2, null), e3.exists) return e3.result;
      if (null !== this._defaultGlobalVariables && (e3 = y(this._defaultGlobalVariables, t2, null), e3.exists)) return e3.result;
      if (null === this._listDefsOrigin) return d("VariablesState._listDefsOrigin");
      let n3 = this._listDefsOrigin.FindSingleItemListWithName(t2);
      if (n3) return n3;
    }
    return n2 = this._callStack.GetTemporaryVariableWithName(t2, e2), n2;
  }
  ValueAtVariablePointer(t2) {
    return this.GetVariableWithName(t2.variableName, t2.contextIndex);
  }
  Assign(t2, e2) {
    let n2 = t2.variableName;
    if (null === n2) return d("name");
    let i2 = -1, r2 = false;
    if (r2 = t2.isNewDeclaration ? t2.isGlobal : this.GlobalVariableExistsWithName(n2), t2.isNewDeclaration) {
      let t3 = a(e2, P);
      if (null !== t3) {
        e2 = this.ResolveVariablePointer(t3);
      }
    } else {
      let t3 = null;
      do {
        t3 = a(this.GetRawVariableWithName(n2, i2), P), null != t3 && (n2 = t3.variableName, i2 = t3.contextIndex, r2 = 0 == i2);
      } while (null != t3);
    }
    r2 ? this.SetGlobal(n2, e2) : this._callStack.SetTemporaryVariable(n2, e2, t2.isNewDeclaration, i2);
  }
  SnapshotDefaultGlobals() {
    this._defaultGlobalVariables = new Map(this._globalVariables);
  }
  RetainListOriginsForAssignment(t2, e2) {
    let n2 = s(t2, N), i2 = s(e2, N);
    n2.value && i2.value && 0 == i2.value.Count && i2.value.SetInitialOriginNames(n2.value.originNames);
  }
  SetGlobal(t2, e2) {
    let n2 = null;
    if (null === this.patch && (n2 = y(this._globalVariables, t2, null)), null !== this.patch && (n2 = this.patch.TryGetGlobal(t2, null), n2.exists || (n2 = y(this._globalVariables, t2, null))), N.RetainListOriginsForAssignment(n2.result, e2), null === t2) return d("variableName");
    if (null !== this.patch ? this.patch.SetGlobal(t2, e2) : this._globalVariables.set(t2, e2), null !== this.variableChangedEvent && null !== n2 && e2 !== n2.result) if (this._batchObservingVariableChanges) {
      if (null === this._changedVariablesForBatchObs) return d("this._changedVariablesForBatchObs");
      null !== this.patch ? this.patch.AddChangedVariable(t2) : null !== this._changedVariablesForBatchObs && this._changedVariablesForBatchObs.add(t2);
    } else this.variableChangedEvent(t2, e2);
  }
  ResolveVariablePointer(t2) {
    let e2 = t2.contextIndex;
    -1 == e2 && (e2 = this.GetContextIndexOfVariableNamed(t2.variableName));
    let n2 = a(this.GetRawVariableWithName(t2.variableName, e2), P);
    return null != n2 ? n2 : new P(t2.variableName, e2);
  }
  GetContextIndexOfVariableNamed(t2) {
    return this.GlobalVariableExistsWithName(t2) ? 0 : this._callStack.currentElementIndex;
  }
  ObserveVariableChange(t2) {
    this.variableChangedEventCallbacks.push(t2);
  }
};
U.dontSaveDefaultValues = true;
var K = class {
  constructor(t2) {
    this.seed = t2 % 2147483647, this.seed <= 0 && (this.seed += 2147483646);
  }
  next() {
    return this.seed = 48271 * this.seed % 2147483647;
  }
  nextFloat() {
    return (this.next() - 1) / 2147483646;
  }
};
var z = class {
  get globals() {
    return this._globals;
  }
  get changedVariables() {
    return this._changedVariables;
  }
  get visitCounts() {
    return this._visitCounts;
  }
  get turnIndices() {
    return this._turnIndices;
  }
  constructor() {
    if (this._changedVariables = /* @__PURE__ */ new Set(), this._visitCounts = /* @__PURE__ */ new Map(), this._turnIndices = /* @__PURE__ */ new Map(), 1 === arguments.length && null !== arguments[0]) {
      let t2 = arguments[0];
      this._globals = new Map(t2._globals), this._changedVariables = new Set(t2._changedVariables), this._visitCounts = new Map(t2._visitCounts), this._turnIndices = new Map(t2._turnIndices);
    } else this._globals = /* @__PURE__ */ new Map(), this._changedVariables = /* @__PURE__ */ new Set(), this._visitCounts = /* @__PURE__ */ new Map(), this._turnIndices = /* @__PURE__ */ new Map();
  }
  TryGetGlobal(t2, e2) {
    return null !== t2 && this._globals.has(t2) ? { result: this._globals.get(t2), exists: true } : { result: e2, exists: false };
  }
  SetGlobal(t2, e2) {
    this._globals.set(t2, e2);
  }
  AddChangedVariable(t2) {
    return this._changedVariables.add(t2);
  }
  TryGetVisitCount(t2, e2) {
    return this._visitCounts.has(t2) ? { result: this._visitCounts.get(t2), exists: true } : { result: e2, exists: false };
  }
  SetVisitCount(t2, e2) {
    this._visitCounts.set(t2, e2);
  }
  SetTurnIndex(t2, e2) {
    this._turnIndices.set(t2, e2);
  }
  TryGetTurnIndex(t2, e2) {
    return this._turnIndices.has(t2) ? { result: this._turnIndices.get(t2), exists: true } : { result: e2, exists: false };
  }
};
var H = class _H {
  static TextToDictionary(t2) {
    return new _H.Reader(t2).ToDictionary();
  }
  static TextToArray(t2) {
    return new _H.Reader(t2).ToArray();
  }
};
!(function(t2) {
  t2.Reader = class {
    constructor(t3) {
      if (JSON.parse("0", ((t4, e3, n2) => null != n2))) {
        const e3 = (t4, e4, n2) => Number.isInteger(e4) && n2.source.endsWith(".0") ? n2.source + "f" : e4;
        this._rootObject = JSON.parse(t3, e3);
      } else {
        const e3 = t3.replace(/(,\s*)([0-9]+\.[0]+)([,]*)/g, '$1"$2f"$3');
        this._rootObject = JSON.parse(e3);
      }
    }
    ToDictionary() {
      return this._rootObject;
    }
    ToArray() {
      return this._rootObject;
    }
  };
  class e2 {
    constructor() {
      this._currentPropertyName = null, this._currentString = null, this._stateStack = [], this._collectionStack = [], this._propertyNameStack = [], this._jsonObject = null;
    }
    WriteObject(t3) {
      this.WriteObjectStart(), t3(this), this.WriteObjectEnd();
    }
    WriteObjectStart() {
      this.StartNewObject(true);
      let e3 = {};
      if (this.state === t2.Writer.State.Property) {
        this.Assert(null !== this.currentCollection), this.Assert(null !== this.currentPropertyName);
        let t3 = this._propertyNameStack.pop();
        this.currentCollection[t3] = e3, this._collectionStack.push(e3);
      } else this.state === t2.Writer.State.Array ? (this.Assert(null !== this.currentCollection), this.currentCollection.push(e3), this._collectionStack.push(e3)) : (this.Assert(this.state === t2.Writer.State.None), this._jsonObject = e3, this._collectionStack.push(e3));
      this._stateStack.push(new t2.Writer.StateElement(t2.Writer.State.Object));
    }
    WriteObjectEnd() {
      this.Assert(this.state === t2.Writer.State.Object), this._collectionStack.pop(), this._stateStack.pop();
    }
    WriteProperty(t3, e3) {
      if (this.WritePropertyStart(t3), arguments[1] instanceof Function) {
        (0, arguments[1])(this);
      } else {
        let t4 = arguments[1];
        this.Write(t4);
      }
      this.WritePropertyEnd();
    }
    WriteIntProperty(t3, e3) {
      this.WritePropertyStart(t3), this.WriteInt(e3), this.WritePropertyEnd();
    }
    WriteFloatProperty(t3, e3) {
      this.WritePropertyStart(t3), this.WriteFloat(e3), this.WritePropertyEnd();
    }
    WritePropertyStart(e3) {
      this.Assert(this.state === t2.Writer.State.Object), this._propertyNameStack.push(e3), this.IncrementChildCount(), this._stateStack.push(new t2.Writer.StateElement(t2.Writer.State.Property));
    }
    WritePropertyEnd() {
      this.Assert(this.state === t2.Writer.State.Property), this.Assert(1 === this.childCount), this._stateStack.pop();
    }
    WritePropertyNameStart() {
      this.Assert(this.state === t2.Writer.State.Object), this.IncrementChildCount(), this._currentPropertyName = "", this._stateStack.push(new t2.Writer.StateElement(t2.Writer.State.Property)), this._stateStack.push(new t2.Writer.StateElement(t2.Writer.State.PropertyName));
    }
    WritePropertyNameEnd() {
      this.Assert(this.state === t2.Writer.State.PropertyName), this.Assert(null !== this._currentPropertyName), this._propertyNameStack.push(this._currentPropertyName), this._currentPropertyName = null, this._stateStack.pop();
    }
    WritePropertyNameInner(e3) {
      this.Assert(this.state === t2.Writer.State.PropertyName), this.Assert(null !== this._currentPropertyName), this._currentPropertyName += e3;
    }
    WriteArrayStart() {
      this.StartNewObject(true);
      let e3 = [];
      if (this.state === t2.Writer.State.Property) {
        this.Assert(null !== this.currentCollection), this.Assert(null !== this.currentPropertyName);
        let t3 = this._propertyNameStack.pop();
        this.currentCollection[t3] = e3, this._collectionStack.push(e3);
      } else this.state === t2.Writer.State.Array ? (this.Assert(null !== this.currentCollection), this.currentCollection.push(e3), this._collectionStack.push(e3)) : (this.Assert(this.state === t2.Writer.State.None), this._jsonObject = e3, this._collectionStack.push(e3));
      this._stateStack.push(new t2.Writer.StateElement(t2.Writer.State.Array));
    }
    WriteArrayEnd() {
      this.Assert(this.state === t2.Writer.State.Array), this._collectionStack.pop(), this._stateStack.pop();
    }
    Write(t3) {
      null !== t3 ? (this.StartNewObject(false), this._addToCurrentObject(t3)) : console.error("Warning: trying to write a null value");
    }
    WriteBool(t3) {
      null !== t3 && (this.StartNewObject(false), this._addToCurrentObject(t3));
    }
    WriteInt(t3) {
      null !== t3 && (this.StartNewObject(false), this._addToCurrentObject(Math.floor(t3)));
    }
    WriteFloat(t3) {
      null !== t3 && (this.StartNewObject(false), t3 == Number.POSITIVE_INFINITY ? this._addToCurrentObject(34e37) : t3 == Number.NEGATIVE_INFINITY ? this._addToCurrentObject(-34e37) : isNaN(t3) ? this._addToCurrentObject(0) : this._addToCurrentObject(t3));
    }
    WriteNull() {
      this.StartNewObject(false), this._addToCurrentObject(null);
    }
    WriteStringStart() {
      this.StartNewObject(false), this._currentString = "", this._stateStack.push(new t2.Writer.StateElement(t2.Writer.State.String));
    }
    WriteStringEnd() {
      this.Assert(this.state == t2.Writer.State.String), this._stateStack.pop(), this._addToCurrentObject(this._currentString), this._currentString = null;
    }
    WriteStringInner(e3) {
      this.Assert(this.state === t2.Writer.State.String), null !== e3 ? this._currentString += e3 : console.error("Warning: trying to write a null string");
    }
    toString() {
      return null === this._jsonObject ? "" : JSON.stringify(this._jsonObject);
    }
    StartNewObject(e3) {
      e3 ? this.Assert(this.state === t2.Writer.State.None || this.state === t2.Writer.State.Property || this.state === t2.Writer.State.Array) : this.Assert(this.state === t2.Writer.State.Property || this.state === t2.Writer.State.Array), this.state === t2.Writer.State.Property && this.Assert(0 === this.childCount), this.state !== t2.Writer.State.Array && this.state !== t2.Writer.State.Property || this.IncrementChildCount();
    }
    get state() {
      return this._stateStack.length > 0 ? this._stateStack[this._stateStack.length - 1].type : t2.Writer.State.None;
    }
    get childCount() {
      return this._stateStack.length > 0 ? this._stateStack[this._stateStack.length - 1].childCount : 0;
    }
    get currentCollection() {
      return this._collectionStack.length > 0 ? this._collectionStack[this._collectionStack.length - 1] : null;
    }
    get currentPropertyName() {
      return this._propertyNameStack.length > 0 ? this._propertyNameStack[this._propertyNameStack.length - 1] : null;
    }
    IncrementChildCount() {
      this.Assert(this._stateStack.length > 0);
      let t3 = this._stateStack.pop();
      t3.childCount++, this._stateStack.push(t3);
    }
    Assert(t3) {
      if (!t3) throw Error("Assert failed while writing JSON");
    }
    _addToCurrentObject(e3) {
      this.Assert(null !== this.currentCollection), this.state === t2.Writer.State.Array ? (this.Assert(Array.isArray(this.currentCollection)), this.currentCollection.push(e3)) : this.state === t2.Writer.State.Property && (this.Assert(!Array.isArray(this.currentCollection)), this.Assert(null !== this.currentPropertyName), this.currentCollection[this.currentPropertyName] = e3, this._propertyNameStack.pop());
    }
  }
  t2.Writer = e2, (function(e3) {
    var n2;
    (n2 = e3.State || (e3.State = {}))[n2.None = 0] = "None", n2[n2.Object = 1] = "Object", n2[n2.Array = 2] = "Array", n2[n2.Property = 3] = "Property", n2[n2.PropertyName = 4] = "PropertyName", n2[n2.String = 5] = "String";
    e3.StateElement = class {
      constructor(e4) {
        this.type = t2.Writer.State.None, this.childCount = 0, this.type = e4;
      }
    };
  })(e2 = t2.Writer || (t2.Writer = {}));
})(H || (H = {}));
var $ = class {
  constructor() {
    let t2 = arguments[0], e2 = arguments[1];
    if (this.name = t2, this.callStack = new q(e2), arguments[2]) {
      let t3 = arguments[2];
      this.callStack.SetJsonToken(t3.callstack, e2), this.outputStream = J.JArrayToRuntimeObjList(t3.outputStream), this.currentChoices = J.JArrayToRuntimeObjList(t3.currentChoices);
      let n2 = t3.choiceThreads;
      void 0 !== n2 && this.LoadFlowChoiceThreads(n2, e2);
    } else this.outputStream = [], this.currentChoices = [];
  }
  WriteJson(t2) {
    t2.WriteObjectStart(), t2.WriteProperty("callstack", ((t3) => this.callStack.WriteJson(t3))), t2.WriteProperty("outputStream", ((t3) => J.WriteListRuntimeObjs(t3, this.outputStream)));
    let e2 = false;
    for (let n2 of this.currentChoices) {
      if (null === n2.threadAtGeneration) return d("c.threadAtGeneration");
      n2.originalThreadIndex = n2.threadAtGeneration.threadIndex, null === this.callStack.ThreadWithIndex(n2.originalThreadIndex) && (e2 || (e2 = true, t2.WritePropertyStart("choiceThreads"), t2.WriteObjectStart()), t2.WritePropertyStart(n2.originalThreadIndex), n2.threadAtGeneration.WriteJson(t2), t2.WritePropertyEnd());
    }
    e2 && (t2.WriteObjectEnd(), t2.WritePropertyEnd()), t2.WriteProperty("currentChoices", ((t3) => {
      t3.WriteArrayStart();
      for (let e3 of this.currentChoices) J.WriteChoice(t3, e3);
      t3.WriteArrayEnd();
    })), t2.WriteObjectEnd();
  }
  LoadFlowChoiceThreads(t2, e2) {
    for (let n2 of this.currentChoices) {
      let i2 = this.callStack.ThreadWithIndex(n2.originalThreadIndex);
      if (null !== i2) n2.threadAtGeneration = i2.Copy();
      else {
        let i3 = t2[`${n2.originalThreadIndex}`];
        n2.threadAtGeneration = new q.Thread(i3, e2);
      }
    }
  }
};
var X = class _X {
  ToJson() {
    let t2 = new H.Writer();
    return this.WriteJson(t2), t2.toString();
  }
  toJson() {
    let t2 = arguments.length > 0 && void 0 !== arguments[0] && arguments[0];
    return this.ToJson(t2);
  }
  LoadJson(t2) {
    let e2 = H.TextToDictionary(t2);
    this.LoadJsonObj(e2), null !== this.onDidLoadState && this.onDidLoadState();
  }
  VisitCountAtPathString(e2) {
    let n2;
    if (null !== this._patch) {
      let i2 = this.story.ContentAtPath(new t(e2)).container;
      if (null === i2) throw new Error("Content at path not found: " + e2);
      if (n2 = this._patch.TryGetVisitCount(i2, 0), n2.exists) return n2.result;
    }
    return n2 = y(this._visitCounts, e2, null), n2.exists ? n2.result : 0;
  }
  VisitCountForContainer(t2) {
    if (null === t2) return d("container");
    if (!t2.visitsShouldBeCounted) return this.story.Error("Read count for target (" + t2.name + " - on " + t2.debugMetadata + ") unknown. The story may need to be compiled with countAllVisits flag (-c)."), 0;
    if (null !== this._patch) {
      let e3 = this._patch.TryGetVisitCount(t2, 0);
      if (e3.exists) return e3.result;
    }
    let e2 = t2.path.toString(), n2 = y(this._visitCounts, e2, null);
    return n2.exists ? n2.result : 0;
  }
  IncrementVisitCountForContainer(t2) {
    if (null !== this._patch) {
      let e3 = this.VisitCountForContainer(t2);
      return e3++, void this._patch.SetVisitCount(t2, e3);
    }
    let e2 = t2.path.toString(), n2 = y(this._visitCounts, e2, null);
    n2.exists ? this._visitCounts.set(e2, n2.result + 1) : this._visitCounts.set(e2, 1);
  }
  RecordTurnIndexVisitToContainer(t2) {
    if (null !== this._patch) return void this._patch.SetTurnIndex(t2, this.currentTurnIndex);
    let e2 = t2.path.toString();
    this._turnIndices.set(e2, this.currentTurnIndex);
  }
  TurnsSinceForContainer(t2) {
    if (t2.turnIndexShouldBeCounted || this.story.Error("TURNS_SINCE() for target (" + t2.name + " - on " + t2.debugMetadata + ") unknown. The story may need to be compiled with countAllVisits flag (-c)."), null !== this._patch) {
      let e3 = this._patch.TryGetTurnIndex(t2, 0);
      if (e3.exists) return this.currentTurnIndex - e3.result;
    }
    let e2 = t2.path.toString(), n2 = y(this._turnIndices, e2, 0);
    return n2.exists ? this.currentTurnIndex - n2.result : -1;
  }
  get callstackDepth() {
    return this.callStack.depth;
  }
  get outputStream() {
    return this._currentFlow.outputStream;
  }
  get currentChoices() {
    return this.canContinue ? [] : this._currentFlow.currentChoices;
  }
  get generatedChoices() {
    return this._currentFlow.currentChoices;
  }
  get currentErrors() {
    return this._currentErrors;
  }
  get currentWarnings() {
    return this._currentWarnings;
  }
  get variablesState() {
    return this._variablesState;
  }
  set variablesState(t2) {
    this._variablesState = t2;
  }
  get callStack() {
    return this._currentFlow.callStack;
  }
  get evaluationStack() {
    return this._evaluationStack;
  }
  get currentTurnIndex() {
    return this._currentTurnIndex;
  }
  set currentTurnIndex(t2) {
    this._currentTurnIndex = t2;
  }
  get currentPathString() {
    let t2 = this.currentPointer;
    return t2.isNull ? null : null === t2.path ? d("pointer.path") : t2.path.toString();
  }
  get previousPathString() {
    let t2 = this.previousPointer;
    return t2.isNull ? null : null === t2.path ? d("previousPointer.path") : t2.path.toString();
  }
  get currentPointer() {
    return this.callStack.currentElement.currentPointer.copy();
  }
  set currentPointer(t2) {
    this.callStack.currentElement.currentPointer = t2.copy();
  }
  get previousPointer() {
    return this.callStack.currentThread.previousPointer.copy();
  }
  set previousPointer(t2) {
    this.callStack.currentThread.previousPointer = t2.copy();
  }
  get canContinue() {
    return !this.currentPointer.isNull && !this.hasError;
  }
  get hasError() {
    return null != this.currentErrors && this.currentErrors.length > 0;
  }
  get hasWarning() {
    return null != this.currentWarnings && this.currentWarnings.length > 0;
  }
  get currentText() {
    if (this._outputStreamTextDirty) {
      let t2 = new m(), e2 = false;
      for (let n2 of this.outputStream) {
        let i2 = a(n2, T);
        if (e2 || null === i2) {
          let t3 = a(n2, I);
          null !== t3 && (t3.commandType == I.CommandType.BeginTag ? e2 = true : t3.commandType == I.CommandType.EndTag && (e2 = false));
        } else t2.Append(i2.value);
      }
      this._currentText = this.CleanOutputWhitespace(t2.toString()), this._outputStreamTextDirty = false;
    }
    return this._currentText;
  }
  CleanOutputWhitespace(t2) {
    let e2 = new m(), n2 = -1, i2 = 0;
    for (let r2 = 0; r2 < t2.length; r2++) {
      let a2 = t2.charAt(r2), s2 = " " == a2 || "	" == a2;
      s2 && -1 == n2 && (n2 = r2), s2 || ("\n" != a2 && n2 > 0 && n2 != i2 && e2.Append(" "), n2 = -1), "\n" == a2 && (i2 = r2 + 1), s2 || e2.Append(a2);
    }
    return e2.toString();
  }
  get currentTags() {
    if (this._outputStreamTagsDirty) {
      this._currentTags = [];
      let t2 = false, e2 = new m();
      for (let n2 of this.outputStream) {
        let i2 = a(n2, I);
        if (null != i2) {
          if (i2.commandType == I.CommandType.BeginTag) {
            if (t2 && e2.Length > 0) {
              let t3 = this.CleanOutputWhitespace(e2.toString());
              this._currentTags.push(t3), e2.Clear();
            }
            t2 = true;
          } else if (i2.commandType == I.CommandType.EndTag) {
            if (e2.Length > 0) {
              let t3 = this.CleanOutputWhitespace(e2.toString());
              this._currentTags.push(t3), e2.Clear();
            }
            t2 = false;
          }
        } else if (t2) {
          let t3 = a(n2, T);
          null !== t3 && e2.Append(t3.value);
        } else {
          let t3 = a(n2, j);
          null != t3 && null != t3.text && t3.text.length > 0 && this._currentTags.push(t3.text);
        }
      }
      if (e2.Length > 0) {
        let t3 = this.CleanOutputWhitespace(e2.toString());
        this._currentTags.push(t3), e2.Clear();
      }
      this._outputStreamTagsDirty = false;
    }
    return this._currentTags;
  }
  get currentFlowName() {
    return this._currentFlow.name;
  }
  get currentFlowIsDefaultFlow() {
    return this._currentFlow.name == this.kDefaultFlowName;
  }
  get aliveFlowNames() {
    if (this._aliveFlowNamesDirty) {
      if (this._aliveFlowNames = [], null != this._namedFlows) for (let t2 of this._namedFlows.keys()) t2 != this.kDefaultFlowName && this._aliveFlowNames.push(t2);
      this._aliveFlowNamesDirty = false;
    }
    return this._aliveFlowNames;
  }
  get inExpressionEvaluation() {
    return this.callStack.currentElement.inExpressionEvaluation;
  }
  set inExpressionEvaluation(t2) {
    this.callStack.currentElement.inExpressionEvaluation = t2;
  }
  constructor(t2) {
    this.kInkSaveStateVersion = 10, this.kMinCompatibleLoadVersion = 8, this.onDidLoadState = null, this._currentErrors = null, this._currentWarnings = null, this.divertedPointer = k.Null, this._currentTurnIndex = 0, this.storySeed = 0, this.previousRandom = 0, this.didSafeExit = false, this._currentText = null, this._currentTags = null, this._outputStreamTextDirty = true, this._outputStreamTagsDirty = true, this._patch = null, this._aliveFlowNames = null, this._namedFlows = null, this.kDefaultFlowName = "DEFAULT_FLOW", this._aliveFlowNamesDirty = true, this.story = t2, this._currentFlow = new $(this.kDefaultFlowName, t2), this.OutputStreamDirty(), this._aliveFlowNamesDirty = true, this._evaluationStack = [], this._variablesState = new U(this.callStack, t2.listDefinitions), this._visitCounts = /* @__PURE__ */ new Map(), this._turnIndices = /* @__PURE__ */ new Map(), this.currentTurnIndex = -1;
    let e2 = (/* @__PURE__ */ new Date()).getTime();
    this.storySeed = new K(e2).next() % 100, this.previousRandom = 0, this.GoToStart();
  }
  GoToStart() {
    this.callStack.currentElement.currentPointer = k.StartOf(this.story.mainContentContainer);
  }
  SwitchFlow_Internal(t2) {
    if (null === t2) throw new Error("Must pass a non-null string to Story.SwitchFlow");
    if (null === this._namedFlows && (this._namedFlows = /* @__PURE__ */ new Map(), this._namedFlows.set(this.kDefaultFlowName, this._currentFlow)), t2 === this._currentFlow.name) return;
    let e2, n2 = y(this._namedFlows, t2, null);
    n2.exists ? e2 = n2.result : (e2 = new $(t2, this.story), this._namedFlows.set(t2, e2), this._aliveFlowNamesDirty = true), this._currentFlow = e2, this.variablesState.callStack = this._currentFlow.callStack, this.OutputStreamDirty();
  }
  SwitchToDefaultFlow_Internal() {
    null !== this._namedFlows && this.SwitchFlow_Internal(this.kDefaultFlowName);
  }
  RemoveFlow_Internal(t2) {
    if (null === t2) throw new Error("Must pass a non-null string to Story.DestroyFlow");
    if (t2 === this.kDefaultFlowName) throw new Error("Cannot destroy default flow");
    if (this._currentFlow.name === t2 && this.SwitchToDefaultFlow_Internal(), null === this._namedFlows) return d("this._namedFlows");
    this._namedFlows.delete(t2), this._aliveFlowNamesDirty = true;
  }
  CopyAndStartPatching(t2) {
    let e2 = new _X(this.story);
    if (e2._patch = new z(this._patch), e2._currentFlow.name = this._currentFlow.name, e2._currentFlow.callStack = new q(this._currentFlow.callStack), e2._currentFlow.outputStream.push(...this._currentFlow.outputStream), e2.OutputStreamDirty(), t2) for (let t3 of this._currentFlow.currentChoices) e2._currentFlow.currentChoices.push(t3.Clone());
    else e2._currentFlow.currentChoices.push(...this._currentFlow.currentChoices);
    if (null !== this._namedFlows) {
      e2._namedFlows = /* @__PURE__ */ new Map();
      for (let [t3, n2] of this._namedFlows) e2._namedFlows.set(t3, n2), e2._aliveFlowNamesDirty = true;
      e2._namedFlows.set(this._currentFlow.name, e2._currentFlow);
    }
    return this.hasError && (e2._currentErrors = [], e2._currentErrors.push(...this.currentErrors || [])), this.hasWarning && (e2._currentWarnings = [], e2._currentWarnings.push(...this.currentWarnings || [])), e2.variablesState = this.variablesState, e2.variablesState.callStack = e2.callStack, e2.variablesState.patch = e2._patch, e2.evaluationStack.push(...this.evaluationStack), this.divertedPointer.isNull || (e2.divertedPointer = this.divertedPointer.copy()), e2.previousPointer = this.previousPointer.copy(), e2._visitCounts = this._visitCounts, e2._turnIndices = this._turnIndices, e2.currentTurnIndex = this.currentTurnIndex, e2.storySeed = this.storySeed, e2.previousRandom = this.previousRandom, e2.didSafeExit = this.didSafeExit, e2;
  }
  RestoreAfterPatch() {
    this.variablesState.callStack = this.callStack, this.variablesState.patch = this._patch;
  }
  ApplyAnyPatch() {
    if (null !== this._patch) {
      this.variablesState.ApplyPatch();
      for (let [t2, e2] of this._patch.visitCounts) this.ApplyCountChanges(t2, e2, true);
      for (let [t2, e2] of this._patch.turnIndices) this.ApplyCountChanges(t2, e2, false);
      this._patch = null;
    }
  }
  ApplyCountChanges(t2, e2, n2) {
    (n2 ? this._visitCounts : this._turnIndices).set(t2.path.toString(), e2);
  }
  WriteJson(t2) {
    if (t2.WriteObjectStart(), t2.WritePropertyStart("flows"), t2.WriteObjectStart(), null !== this._namedFlows) for (let [e2, n2] of this._namedFlows) t2.WriteProperty(e2, ((t3) => n2.WriteJson(t3)));
    else t2.WriteProperty(this._currentFlow.name, ((t3) => this._currentFlow.WriteJson(t3)));
    if (t2.WriteObjectEnd(), t2.WritePropertyEnd(), t2.WriteProperty("currentFlowName", this._currentFlow.name), t2.WriteProperty("variablesState", ((t3) => this.variablesState.WriteJson(t3))), t2.WriteProperty("evalStack", ((t3) => J.WriteListRuntimeObjs(t3, this.evaluationStack))), !this.divertedPointer.isNull) {
      if (null === this.divertedPointer.path) return d("divertedPointer");
      t2.WriteProperty("currentDivertTarget", this.divertedPointer.path.componentsString);
    }
    t2.WriteProperty("visitCounts", ((t3) => J.WriteIntDictionary(t3, this._visitCounts))), t2.WriteProperty("turnIndices", ((t3) => J.WriteIntDictionary(t3, this._turnIndices))), t2.WriteIntProperty("turnIdx", this.currentTurnIndex), t2.WriteIntProperty("storySeed", this.storySeed), t2.WriteIntProperty("previousRandom", this.previousRandom), t2.WriteIntProperty("inkSaveVersion", this.kInkSaveStateVersion), t2.WriteIntProperty("inkFormatVersion", Q.inkVersionCurrent), t2.WriteObjectEnd();
  }
  LoadJsonObj(e2) {
    let n2 = e2, i2 = n2.inkSaveVersion;
    if (null == i2) throw new Error("ink save format incorrect, can't load.");
    if (parseInt(i2) < this.kMinCompatibleLoadVersion) throw new Error("Ink save format isn't compatible with the current version (saw '" + i2 + "', but minimum is " + this.kMinCompatibleLoadVersion + "), so can't load.");
    let r2 = n2.flows;
    if (null != r2) {
      let t2 = r2;
      1 === Object.keys(t2).length ? this._namedFlows = null : null === this._namedFlows ? this._namedFlows = /* @__PURE__ */ new Map() : this._namedFlows.clear();
      let e3 = Object.entries(t2);
      for (let [n3, i3] of e3) {
        let e4 = n3, r3 = i3, a3 = new $(e4, this.story, r3);
        if (1 === Object.keys(t2).length) this._currentFlow = new $(e4, this.story, r3);
        else {
          if (null === this._namedFlows) return d("this._namedFlows");
          this._namedFlows.set(e4, a3);
        }
      }
      if (null != this._namedFlows && this._namedFlows.size > 1) {
        let t3 = n2.currentFlowName;
        this._currentFlow = this._namedFlows.get(t3);
      }
    } else {
      this._namedFlows = null, this._currentFlow.name = this.kDefaultFlowName, this._currentFlow.callStack.SetJsonToken(n2.callstackThreads, this.story), this._currentFlow.outputStream = J.JArrayToRuntimeObjList(n2.outputStream), this._currentFlow.currentChoices = J.JArrayToRuntimeObjList(n2.currentChoices);
      let t2 = n2.choiceThreads;
      this._currentFlow.LoadFlowChoiceThreads(t2, this.story);
    }
    this.OutputStreamDirty(), this._aliveFlowNamesDirty = true, this.variablesState.SetJsonToken(n2.variablesState), this.variablesState.callStack = this._currentFlow.callStack, this._evaluationStack = J.JArrayToRuntimeObjList(n2.evalStack);
    let a2 = n2.currentDivertTarget;
    if (null != a2) {
      let e3 = new t(a2.toString());
      this.divertedPointer = this.story.PointerAtPath(e3);
    }
    this._visitCounts = J.JObjectToIntDictionary(n2.visitCounts), this._turnIndices = J.JObjectToIntDictionary(n2.turnIndices), this.currentTurnIndex = parseInt(n2.turnIdx), this.storySeed = parseInt(n2.storySeed), this.previousRandom = parseInt(n2.previousRandom);
  }
  ResetErrors() {
    this._currentErrors = null, this._currentWarnings = null;
  }
  ResetOutput() {
    let t2 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : null;
    this.outputStream.length = 0, null !== t2 && this.outputStream.push(...t2), this.OutputStreamDirty();
  }
  PushToOutputStream(t2) {
    let e2 = a(t2, T);
    if (null !== e2) {
      let t3 = this.TrySplittingHeadTailWhitespace(e2);
      if (null !== t3) {
        for (let e3 of t3) this.PushToOutputStreamIndividual(e3);
        return void this.OutputStreamDirty();
      }
    }
    this.PushToOutputStreamIndividual(t2), this.OutputStreamDirty();
  }
  PopFromOutputStream(t2) {
    this.outputStream.splice(this.outputStream.length - t2, t2), this.OutputStreamDirty();
  }
  TrySplittingHeadTailWhitespace(t2) {
    let e2 = t2.value;
    if (null === e2) return d("single.value");
    let n2 = -1, i2 = -1;
    for (let t3 = 0; t3 < e2.length; t3++) {
      let r3 = e2[t3];
      if ("\n" != r3) {
        if (" " == r3 || "	" == r3) continue;
        break;
      }
      -1 == n2 && (n2 = t3), i2 = t3;
    }
    let r2 = -1, a2 = -1;
    for (let t3 = e2.length - 1; t3 >= 0; t3--) {
      let n3 = e2[t3];
      if ("\n" != n3) {
        if (" " == n3 || "	" == n3) continue;
        break;
      }
      -1 == r2 && (r2 = t3), a2 = t3;
    }
    if (-1 == n2 && -1 == r2) return null;
    let s2 = [], l2 = 0, o2 = e2.length;
    if (-1 != n2) {
      if (n2 > 0) {
        let t3 = new T(e2.substring(0, n2));
        s2.push(t3);
      }
      s2.push(new T("\n")), l2 = i2 + 1;
    }
    if (-1 != r2 && (o2 = a2), o2 > l2) {
      let t3 = e2.substring(l2, o2);
      s2.push(new T(t3));
    }
    if (-1 != r2 && a2 > i2 && (s2.push(new T("\n")), r2 < e2.length - 1)) {
      let t3 = e2.length - r2 - 1, n3 = new T(e2.substring(r2 + 1, r2 + 1 + t3));
      s2.push(n3);
    }
    return s2;
  }
  PushToOutputStreamIndividual(t2) {
    let e2 = a(t2, x), n2 = a(t2, T), r2 = true;
    if (e2) this.TrimNewlinesFromOutputStream(), r2 = true;
    else if (n2) {
      let t3 = -1, e3 = this.callStack.currentElement;
      e3.type == i.Function && (t3 = e3.functionStartInOutputStream);
      let a2 = -1;
      for (let e4 = this.outputStream.length - 1; e4 >= 0; e4--) {
        let n3 = this.outputStream[e4], i2 = n3 instanceof I ? n3 : null;
        if (null != (n3 instanceof x ? n3 : null)) {
          a2 = e4;
          break;
        }
        if (null != i2 && i2.commandType == I.CommandType.BeginString) {
          e4 >= t3 && (t3 = -1);
          break;
        }
      }
      let s2 = -1;
      if (s2 = -1 != a2 && -1 != t3 ? Math.min(t3, a2) : -1 != a2 ? a2 : t3, -1 != s2) {
        if (n2.isNewline) r2 = false;
        else if (n2.isNonWhitespace && (a2 > -1 && this.RemoveExistingGlue(), t3 > -1)) {
          let t4 = this.callStack.elements;
          for (let e4 = t4.length - 1; e4 >= 0; e4--) {
            let n3 = t4[e4];
            if (n3.type != i.Function) break;
            n3.functionStartInOutputStream = -1;
          }
        }
      } else n2.isNewline && (!this.outputStreamEndsInNewline && this.outputStreamContainsContent || (r2 = false));
    }
    if (r2) {
      if (null === t2) return d("obj");
      this.outputStream.push(t2), this.OutputStreamDirty();
    }
  }
  TrimNewlinesFromOutputStream() {
    let t2 = -1, e2 = this.outputStream.length - 1;
    for (; e2 >= 0; ) {
      let n2 = this.outputStream[e2], i2 = a(n2, I), r2 = a(n2, T);
      if (null != i2 || null != r2 && r2.isNonWhitespace) break;
      null != r2 && r2.isNewline && (t2 = e2), e2--;
    }
    if (t2 >= 0) for (e2 = t2; e2 < this.outputStream.length; ) {
      a(this.outputStream[e2], T) ? this.outputStream.splice(e2, 1) : e2++;
    }
    this.OutputStreamDirty();
  }
  RemoveExistingGlue() {
    for (let t2 = this.outputStream.length - 1; t2 >= 0; t2--) {
      let e2 = this.outputStream[t2];
      if (e2 instanceof x) this.outputStream.splice(t2, 1);
      else if (e2 instanceof I) break;
    }
    this.OutputStreamDirty();
  }
  get outputStreamEndsInNewline() {
    if (this.outputStream.length > 0) for (let t2 = this.outputStream.length - 1; t2 >= 0; t2--) {
      if (this.outputStream[t2] instanceof I) break;
      let e2 = this.outputStream[t2];
      if (e2 instanceof T) {
        if (e2.isNewline) return true;
        if (e2.isNonWhitespace) break;
      }
    }
    return false;
  }
  get outputStreamContainsContent() {
    for (let t2 of this.outputStream) if (t2 instanceof T) return true;
    return false;
  }
  get inStringEvaluation() {
    for (let t2 = this.outputStream.length - 1; t2 >= 0; t2--) {
      let e2 = a(this.outputStream[t2], I);
      if (e2 instanceof I && e2.commandType == I.CommandType.BeginString) return true;
    }
    return false;
  }
  PushEvaluationStack(t2) {
    let e2 = a(t2, N);
    if (e2) {
      let t3 = e2.value;
      if (null === t3) return d("rawList");
      if (null != t3.originNames) {
        t3.origins || (t3.origins = []), t3.origins.length = 0;
        for (let e3 of t3.originNames) {
          if (null === this.story.listDefinitions) return d("StoryState.story.listDefinitions");
          let n2 = this.story.listDefinitions.TryListGetDefinition(e3, null);
          if (null === n2.result) return d("StoryState def.result");
          t3.origins.indexOf(n2.result) < 0 && t3.origins.push(n2.result);
        }
      }
    }
    if (null === t2) return d("obj");
    this.evaluationStack.push(t2);
  }
  PopEvaluationStack(t2) {
    if (void 0 === t2) {
      return o(this.evaluationStack.pop());
    }
    if (t2 > this.evaluationStack.length) throw new Error("trying to pop too many objects");
    return o(this.evaluationStack.splice(this.evaluationStack.length - t2, t2));
  }
  PeekEvaluationStack() {
    return this.evaluationStack[this.evaluationStack.length - 1];
  }
  ForceEnd() {
    this.callStack.Reset(), this._currentFlow.currentChoices.length = 0, this.currentPointer = k.Null, this.previousPointer = k.Null, this.didSafeExit = true;
  }
  TrimWhitespaceFromFunctionEnd() {
    e.Assert(this.callStack.currentElement.type == i.Function);
    let t2 = this.callStack.currentElement.functionStartInOutputStream;
    -1 == t2 && (t2 = 0);
    for (let e2 = this.outputStream.length - 1; e2 >= t2; e2--) {
      let t3 = this.outputStream[e2], n2 = a(t3, T), i2 = a(t3, I);
      if (null != n2) {
        if (i2) break;
        if (!n2.isNewline && !n2.isInlineWhitespace) break;
        this.outputStream.splice(e2, 1), this.OutputStreamDirty();
      }
    }
  }
  PopCallStack() {
    let t2 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : null;
    this.callStack.currentElement.type == i.Function && this.TrimWhitespaceFromFunctionEnd(), this.callStack.Pop(t2);
  }
  SetChosenPath(t2, e2) {
    this._currentFlow.currentChoices.length = 0;
    let n2 = this.story.PointerAtPath(t2);
    n2.isNull || -1 != n2.index || (n2.index = 0), this.currentPointer = n2, e2 && this.currentTurnIndex++;
  }
  StartFunctionEvaluationFromGame(t2, e2) {
    this.callStack.Push(i.FunctionEvaluationFromGame, this.evaluationStack.length), this.callStack.currentElement.currentPointer = k.StartOf(t2), this.PassArgumentsToEvaluationStack(e2);
  }
  PassArgumentsToEvaluationStack(t2) {
    if (null !== t2) for (let e2 = 0; e2 < t2.length; e2++) {
      if (!("number" == typeof t2[e2] || "string" == typeof t2[e2] || "boolean" == typeof t2[e2] || t2[e2] instanceof g)) throw new Error("ink arguments when calling EvaluateFunction / ChoosePathStringWithParameters must benumber, string, bool or InkList. Argument was " + (null === o(t2[e2]) ? "null" : t2[e2].constructor.name));
      this.PushEvaluationStack(C.Create(t2[e2]));
    }
  }
  TryExitFunctionEvaluationFromGame() {
    return this.callStack.currentElement.type == i.FunctionEvaluationFromGame && (this.currentPointer = k.Null, this.didSafeExit = true, true);
  }
  CompleteFunctionEvaluationFromGame() {
    if (this.callStack.currentElement.type != i.FunctionEvaluationFromGame) throw new Error("Expected external function evaluation to be complete. Stack trace: " + this.callStack.callStackTrace);
    let t2 = this.callStack.currentElement.evaluationStackHeightWhenPushed, e2 = null;
    for (; this.evaluationStack.length > t2; ) {
      let t3 = this.PopEvaluationStack();
      null === e2 && (e2 = t3);
    }
    if (this.PopCallStack(i.FunctionEvaluationFromGame), e2) {
      if (e2 instanceof D) return null;
      let t3 = s(e2, C);
      return t3.valueType == n.DivertTarget ? "-> " + t3.valueObject.toString() : t3.valueObject;
    }
    return null;
  }
  AddError(t2, e2) {
    e2 ? (null == this._currentWarnings && (this._currentWarnings = []), this._currentWarnings.push(t2)) : (null == this._currentErrors && (this._currentErrors = []), this._currentErrors.push(t2));
  }
  OutputStreamDirty() {
    this._outputStreamTextDirty = true, this._outputStreamTagsDirty = true;
  }
};
var Y = class {
  constructor() {
    this.startTime = void 0;
  }
  get ElapsedMilliseconds() {
    return void 0 === this.startTime ? 0 : (/* @__PURE__ */ new Date()).getTime() - this.startTime;
  }
  Start() {
    this.startTime = (/* @__PURE__ */ new Date()).getTime();
  }
  Stop() {
    this.startTime = void 0;
  }
};
!(function(t2) {
  t2[t2.Author = 0] = "Author", t2[t2.Warning = 1] = "Warning", t2[t2.Error = 2] = "Error";
})(r || (r = {})), Number.isInteger || (Number.isInteger = function(t2) {
  return "number" == typeof t2 && isFinite(t2) && t2 > -9007199254740992 && t2 < 9007199254740992 && Math.floor(t2) === t2;
});
var Q = class _Q extends p {
  get currentChoices() {
    let t2 = [];
    if (null === this._state) return d("this._state");
    for (let e2 of this._state.currentChoices) e2.isInvisibleDefault || (e2.index = t2.length, t2.push(e2));
    return t2;
  }
  get currentText() {
    return this.IfAsyncWeCant("call currentText since it's a work in progress"), this.state.currentText;
  }
  get currentTags() {
    return this.IfAsyncWeCant("call currentTags since it's a work in progress"), this.state.currentTags;
  }
  get currentErrors() {
    return this.state.currentErrors;
  }
  get currentWarnings() {
    return this.state.currentWarnings;
  }
  get currentFlowName() {
    return this.state.currentFlowName;
  }
  get currentFlowIsDefaultFlow() {
    return this.state.currentFlowIsDefaultFlow;
  }
  get aliveFlowNames() {
    return this.state.aliveFlowNames;
  }
  get hasError() {
    return this.state.hasError;
  }
  get hasWarning() {
    return this.state.hasWarning;
  }
  get variablesState() {
    return this.state.variablesState;
  }
  get listDefinitions() {
    return this._listDefinitions;
  }
  get state() {
    return this._state;
  }
  StartProfiling() {
  }
  EndProfiling() {
  }
  constructor() {
    let t2;
    super(), this.inkVersionMinimumCompatible = 18, this.onError = null, this.onDidContinue = null, this.onMakeChoice = null, this.onEvaluateFunction = null, this.onCompleteEvaluateFunction = null, this.onChoosePathString = null, this._prevContainers = [], this.allowExternalFunctionFallbacks = false, this._listDefinitions = null, this._variableObservers = null, this._hasValidatedExternals = false, this._temporaryEvaluationContainer = null, this._asyncContinueActive = false, this._stateSnapshotAtLastNewline = null, this._sawLookaheadUnsafeFunctionAfterNewline = false, this._recursiveContinueCount = 0, this._asyncSaving = false, this._profiler = null;
    let e2 = null, n2 = null;
    if (arguments[0] instanceof A) t2 = arguments[0], void 0 !== arguments[1] && (e2 = arguments[1]), this._mainContentContainer = t2;
    else if ("string" == typeof arguments[0]) {
      let t3 = arguments[0];
      n2 = H.TextToDictionary(t3);
    } else n2 = arguments[0];
    if (null != e2 && (this._listDefinitions = new M(e2)), this._externals = /* @__PURE__ */ new Map(), null !== n2) {
      let t3 = n2, e3 = t3.inkVersion;
      if (null == e3) throw new Error("ink version number not found. Are you sure it's a valid .ink.json file?");
      let i2 = parseInt(e3);
      if (i2 > _Q.inkVersionCurrent) throw new Error("Version of ink used to build story was newer than the current version of the engine");
      if (i2 < this.inkVersionMinimumCompatible) throw new Error("Version of ink used to build story is too old to be loaded by this version of the engine");
      i2 != _Q.inkVersionCurrent && console.warn(`WARNING: Version of ink ${_Q.inkVersionCurrent} used to build story doesn't match current version of engine (${i2}). Non-critical, but recommend synchronising.`);
      let r2, a2 = t3.root;
      if (null == a2) throw new Error("Root node for ink not found. Are you sure it's a valid .ink.json file?");
      (r2 = t3.listDefs) && (this._listDefinitions = J.JTokenToListDefinitions(r2)), this._mainContentContainer = s(J.JTokenToRuntimeObject(a2), A), this.ResetState();
    }
  }
  ToJson(t2) {
    let e2 = false;
    if (t2 || (e2 = true, t2 = new H.Writer()), t2.WriteObjectStart(), t2.WriteIntProperty("inkVersion", _Q.inkVersionCurrent), t2.WriteProperty("root", ((t3) => J.WriteRuntimeContainer(t3, this._mainContentContainer))), null != this._listDefinitions) {
      t2.WritePropertyStart("listDefs"), t2.WriteObjectStart();
      for (let e3 of this._listDefinitions.lists) {
        t2.WritePropertyStart(e3.name), t2.WriteObjectStart();
        for (let [n2, i2] of e3.items) {
          let e4 = f.fromSerializedKey(n2), r2 = i2;
          t2.WriteIntProperty(e4.itemName, r2);
        }
        t2.WriteObjectEnd(), t2.WritePropertyEnd();
      }
      t2.WriteObjectEnd(), t2.WritePropertyEnd();
    }
    if (t2.WriteObjectEnd(), e2) return t2.toString();
  }
  ResetState() {
    this.IfAsyncWeCant("ResetState"), this._state = new X(this), this._state.variablesState.ObserveVariableChange(this.VariableStateDidChangeEvent.bind(this)), this.ResetGlobals();
  }
  ResetErrors() {
    if (null === this._state) return d("this._state");
    this._state.ResetErrors();
  }
  ResetCallstack() {
    if (this.IfAsyncWeCant("ResetCallstack"), null === this._state) return d("this._state");
    this._state.ForceEnd();
  }
  ResetGlobals() {
    if (this._mainContentContainer.namedContent.get("global decl")) {
      let e2 = this.state.currentPointer.copy();
      this.ChoosePath(new t("global decl"), false), this.ContinueInternal(), this.state.currentPointer = e2;
    }
    this.state.variablesState.SnapshotDefaultGlobals();
  }
  SwitchFlow(t2) {
    if (this.IfAsyncWeCant("switch flow"), this._asyncSaving) throw new Error("Story is already in background saving mode, can't switch flow to " + t2);
    this.state.SwitchFlow_Internal(t2);
  }
  RemoveFlow(t2) {
    this.state.RemoveFlow_Internal(t2);
  }
  SwitchToDefaultFlow() {
    this.state.SwitchToDefaultFlow_Internal();
  }
  Continue() {
    return this.ContinueAsync(0), this.currentText;
  }
  get canContinue() {
    return this.state.canContinue;
  }
  get asyncContinueComplete() {
    return !this._asyncContinueActive;
  }
  ContinueAsync(t2) {
    this._hasValidatedExternals || this.ValidateExternalBindings(), this.ContinueInternal(t2);
  }
  ContinueInternal() {
    let t2 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : 0;
    null != this._profiler && this._profiler.PreContinue();
    let e2 = t2 > 0;
    if (this._recursiveContinueCount++, this._asyncContinueActive) this._asyncContinueActive && !e2 && (this._asyncContinueActive = false);
    else {
      if (this._asyncContinueActive = e2, !this.canContinue) throw new Error("Can't continue - should check canContinue before calling Continue");
      this._state.didSafeExit = false, this._state.ResetOutput(), 1 == this._recursiveContinueCount && this._state.variablesState.StartVariableObservation();
    }
    let n2 = new Y();
    n2.Start();
    let a2 = false;
    this._sawLookaheadUnsafeFunctionAfterNewline = false;
    do {
      try {
        a2 = this.ContinueSingleStep();
      } catch (t3) {
        if (!(t3 instanceof S)) throw t3;
        this.AddError(t3.message, void 0, t3.useEndLineNumber);
        break;
      }
      if (a2) break;
      if (this._asyncContinueActive && n2.ElapsedMilliseconds > t2) break;
    } while (this.canContinue);
    n2.Stop();
    let s2 = null;
    if (!a2 && this.canContinue || (null !== this._stateSnapshotAtLastNewline && this.RestoreStateSnapshot(), this.canContinue || (this.state.callStack.canPopThread && this.AddError("Thread available to pop, threads should always be flat by the end of evaluation?"), 0 != this.state.generatedChoices.length || this.state.didSafeExit || null != this._temporaryEvaluationContainer || (this.state.callStack.CanPop(i.Tunnel) ? this.AddError("unexpectedly reached end of content. Do you need a '->->' to return from a tunnel?") : this.state.callStack.CanPop(i.Function) ? this.AddError("unexpectedly reached end of content. Do you need a '~ return'?") : this.state.callStack.canPop ? this.AddError("unexpectedly reached end of content for unknown reason. Please debug compiler!") : this.AddError("ran out of content. Do you need a '-> DONE' or '-> END'?"))), this.state.didSafeExit = false, this._sawLookaheadUnsafeFunctionAfterNewline = false, 1 == this._recursiveContinueCount && (s2 = this._state.variablesState.CompleteVariableObservation()), this._asyncContinueActive = false, null !== this.onDidContinue && this.onDidContinue()), this._recursiveContinueCount--, null != this._profiler && this._profiler.PostContinue(), this.state.hasError || this.state.hasWarning) {
      if (null === this.onError) {
        let t3 = new m();
        throw t3.Append("Ink had "), this.state.hasError && (t3.Append(`${this.state.currentErrors.length}`), t3.Append(1 == this.state.currentErrors.length ? " error" : " errors"), this.state.hasWarning && t3.Append(" and ")), this.state.hasWarning && (t3.Append(`${this.state.currentWarnings.length}`), t3.Append(1 == this.state.currentWarnings.length ? " warning" : " warnings"), this.state.hasWarning && t3.Append(" and ")), t3.Append(". It is strongly suggested that you assign an error handler to story.onError. The first issue was: "), t3.Append(this.state.hasError ? this.state.currentErrors[0] : this.state.currentWarnings[0]), new S(t3.toString());
      }
      if (this.state.hasError) for (let t3 of this.state.currentErrors) this.onError(t3, r.Error);
      if (this.state.hasWarning) for (let t3 of this.state.currentWarnings) this.onError(t3, r.Warning);
      this.ResetErrors();
    }
    null != s2 && Object.keys(s2).length > 0 && this._state.variablesState.NotifyObservers(s2);
  }
  ContinueSingleStep() {
    if (null != this._profiler && this._profiler.PreStep(), this.Step(), null != this._profiler && this._profiler.PostStep(), this.canContinue || this.state.callStack.elementIsEvaluateFromGame || this.TryFollowDefaultInvisibleChoice(), null != this._profiler && this._profiler.PreSnapshot(), !this.state.inStringEvaluation) {
      if (null !== this._stateSnapshotAtLastNewline) {
        if (null === this._stateSnapshotAtLastNewline.currentTags) return d("this._stateAtLastNewline.currentTags");
        if (null === this.state.currentTags) return d("this.state.currentTags");
        let t2 = this.CalculateNewlineOutputStateChange(this._stateSnapshotAtLastNewline.currentText, this.state.currentText, this._stateSnapshotAtLastNewline.currentTags.length, this.state.currentTags.length);
        if (t2 == _Q.OutputStateChange.ExtendedBeyondNewline || this._sawLookaheadUnsafeFunctionAfterNewline) return this.RestoreStateSnapshot(), true;
        t2 == _Q.OutputStateChange.NewlineRemoved && this.DiscardSnapshot();
      }
      this.state.outputStreamEndsInNewline && (this.canContinue ? null == this._stateSnapshotAtLastNewline && this.StateSnapshot() : this.DiscardSnapshot());
    }
    return null != this._profiler && this._profiler.PostSnapshot(), false;
  }
  CalculateNewlineOutputStateChange(t2, e2, n2, i2) {
    if (null === t2) return d("prevText");
    if (null === e2) return d("currText");
    let r2 = e2.length >= t2.length && t2.length > 0 && "\n" == e2.charAt(t2.length - 1);
    if (n2 == i2 && t2.length == e2.length && r2) return _Q.OutputStateChange.NoChange;
    if (!r2) return _Q.OutputStateChange.NewlineRemoved;
    if (i2 > n2) return _Q.OutputStateChange.ExtendedBeyondNewline;
    for (let n3 = t2.length; n3 < e2.length; n3++) {
      let t3 = e2.charAt(n3);
      if (" " != t3 && "	" != t3) return _Q.OutputStateChange.ExtendedBeyondNewline;
    }
    return _Q.OutputStateChange.NoChange;
  }
  ContinueMaximally() {
    this.IfAsyncWeCant("ContinueMaximally");
    let t2 = new m();
    for (; this.canContinue; ) t2.Append(this.Continue());
    return t2.toString();
  }
  ContentAtPath(t2) {
    return this.mainContentContainer.ContentAtPath(t2);
  }
  KnotContainerWithName(t2) {
    let e2 = this.mainContentContainer.namedContent.get(t2);
    return e2 instanceof A ? e2 : null;
  }
  PointerAtPath(t2) {
    if (0 == t2.length) return k.Null;
    let e2 = new k(), n2 = t2.length, i2 = null;
    return null === t2.lastComponent ? d("path.lastComponent") : (t2.lastComponent.isIndex ? (n2 = t2.length - 1, i2 = this.mainContentContainer.ContentAtPath(t2, void 0, n2), e2.container = i2.container, e2.index = t2.lastComponent.index) : (i2 = this.mainContentContainer.ContentAtPath(t2), e2.container = i2.container, e2.index = -1), null == i2.obj || i2.obj == this.mainContentContainer && n2 > 0 ? this.Error("Failed to find content at path '" + t2 + "', and no approximation of it was possible.") : i2.approximate && this.Warning("Failed to find content at path '" + t2 + "', so it was approximated to: '" + i2.obj.path + "'."), e2);
  }
  StateSnapshot() {
    this._stateSnapshotAtLastNewline = this._state, this._state = this._state.CopyAndStartPatching(false);
  }
  RestoreStateSnapshot() {
    null === this._stateSnapshotAtLastNewline && d("_stateSnapshotAtLastNewline"), this._stateSnapshotAtLastNewline.RestoreAfterPatch(), this._state = this._stateSnapshotAtLastNewline, this._stateSnapshotAtLastNewline = null, this._asyncSaving || this._state.ApplyAnyPatch();
  }
  DiscardSnapshot() {
    this._asyncSaving || this._state.ApplyAnyPatch(), this._stateSnapshotAtLastNewline = null;
  }
  CopyStateForBackgroundThreadSave() {
    if (this.IfAsyncWeCant("start saving on a background thread"), this._asyncSaving) throw new Error("Story is already in background saving mode, can't call CopyStateForBackgroundThreadSave again!");
    let t2 = this._state;
    return this._state = this._state.CopyAndStartPatching(true), this._asyncSaving = true, t2;
  }
  BackgroundSaveComplete() {
    null === this._stateSnapshotAtLastNewline && this._state.ApplyAnyPatch(), this._asyncSaving = false;
  }
  Step() {
    let t2 = true, e2 = this.state.currentPointer.copy();
    if (e2.isNull) return;
    let n2 = a(e2.Resolve(), A);
    for (; n2 && (this.VisitContainer(n2, true), 0 != n2.content.length); ) e2 = k.StartOf(n2), n2 = a(e2.Resolve(), A);
    this.state.currentPointer = e2.copy(), null != this._profiler && this._profiler.Step(this.state.callStack);
    let i2 = e2.Resolve(), r2 = this.PerformLogicAndFlowControl(i2);
    if (this.state.currentPointer.isNull) return;
    r2 && (t2 = false);
    let s2 = a(i2, W);
    if (s2) {
      let e3 = this.ProcessChoice(s2);
      e3 && this.state.generatedChoices.push(e3), i2 = null, t2 = false;
    }
    if (i2 instanceof A && (t2 = false), t2) {
      let t3 = a(i2, P);
      if (t3 && -1 == t3.contextIndex) {
        let e3 = this.state.callStack.ContextForVariableNamed(t3.variableName);
        i2 = new P(t3.variableName, e3);
      }
      this.state.inExpressionEvaluation ? this.state.PushEvaluationStack(i2) : this.state.PushToOutputStream(i2);
    }
    this.NextContent();
    let l2 = a(i2, I);
    l2 && l2.commandType == I.CommandType.StartThread && this.state.callStack.PushThread();
  }
  VisitContainer(t2, e2) {
    t2.countingAtStartOnly && !e2 || (t2.visitsShouldBeCounted && this.state.IncrementVisitCountForContainer(t2), t2.turnIndexShouldBeCounted && this.state.RecordTurnIndexVisitToContainer(t2));
  }
  VisitChangedContainersDueToDivert() {
    let t2 = this.state.previousPointer.copy(), e2 = this.state.currentPointer.copy();
    if (e2.isNull || -1 == e2.index) return;
    if (this._prevContainers.length = 0, !t2.isNull) {
      let e3 = a(t2.Resolve(), A) || a(t2.container, A);
      for (; e3; ) this._prevContainers.push(e3), e3 = a(e3.parent, A);
    }
    let n2 = e2.Resolve();
    if (null == n2) return;
    let i2 = a(n2.parent, A), r2 = true;
    for (; i2 && (this._prevContainers.indexOf(i2) < 0 || i2.countingAtStartOnly); ) {
      let t3 = i2.content.length > 0 && n2 == i2.content[0] && r2;
      t3 || (r2 = false), this.VisitContainer(i2, t3), n2 = i2, i2 = a(i2.parent, A);
    }
  }
  PopChoiceStringAndTags(t2) {
    let e2 = s(this.state.PopEvaluationStack(), T);
    for (; this.state.evaluationStack.length > 0 && null != a(this.state.PeekEvaluationStack(), j); ) {
      let e3 = a(this.state.PopEvaluationStack(), j);
      e3 && t2.push(e3.text);
    }
    return e2.value;
  }
  ProcessChoice(t2) {
    let e2 = true;
    if (t2.hasCondition) {
      let t3 = this.state.PopEvaluationStack();
      this.IsTruthy(t3) || (e2 = false);
    }
    let n2 = "", i2 = "", r2 = [];
    if (t2.hasChoiceOnlyContent && (i2 = this.PopChoiceStringAndTags(r2) || ""), t2.hasStartContent && (n2 = this.PopChoiceStringAndTags(r2) || ""), t2.onceOnly) {
      this.state.VisitCountForContainer(t2.choiceTarget) > 0 && (e2 = false);
    }
    if (!e2) return null;
    let a2 = new B();
    return a2.targetPath = t2.pathOnChoice, a2.sourcePath = t2.path.toString(), a2.isInvisibleDefault = t2.isInvisibleDefault, a2.threadAtGeneration = this.state.callStack.ForkThread(), a2.tags = r2.reverse(), a2.text = (n2 + i2).replace(/^[ \t]+|[ \t]+$/g, ""), a2;
  }
  IsTruthy(t2) {
    if (t2 instanceof C) {
      let e2 = t2;
      if (e2 instanceof E) {
        let t3 = e2;
        return this.Error("Shouldn't use a divert target (to " + t3.targetPath + ") as a conditional value. Did you intend a function call 'likeThis()' or a read count check 'likeThis'? (no arrows)"), false;
      }
      return e2.isTruthy;
    }
    return false;
  }
  PerformLogicAndFlowControl(t2) {
    if (null == t2) return false;
    if (t2 instanceof F) {
      let e2 = t2;
      if (e2.isConditional) {
        let t3 = this.state.PopEvaluationStack();
        if (!this.IsTruthy(t3)) return true;
      }
      if (e2.hasVariableTarget) {
        let t3 = e2.variableDivertName, n2 = this.state.variablesState.GetVariableWithName(t3);
        if (null == n2) this.Error("Tried to divert using a target from a variable that could not be found (" + t3 + ")");
        else if (!(n2 instanceof E)) {
          let e3 = a(n2, _), i3 = "Tried to divert to a target from a variable, but the variable (" + t3 + ") didn't contain a divert target, it ";
          e3 instanceof _ && 0 == e3.value ? i3 += "was empty/null (the value 0)." : i3 += "contained '" + n2 + "'.", this.Error(i3);
        }
        let i2 = s(n2, E);
        this.state.divertedPointer = this.PointerAtPath(i2.targetPath);
      } else {
        if (e2.isExternal) return this.CallExternalFunction(e2.targetPathString, e2.externalArgs), true;
        this.state.divertedPointer = e2.targetPointer.copy();
      }
      return e2.pushesToStack && this.state.callStack.Push(e2.stackPushType, void 0, this.state.outputStream.length), this.state.divertedPointer.isNull && !e2.isExternal && (e2 && e2.debugMetadata && null != e2.debugMetadata.sourceName ? this.Error("Divert target doesn't exist: " + e2.debugMetadata.sourceName) : this.Error("Divert resolution failed: " + e2)), true;
    }
    if (t2 instanceof I) {
      let e2 = t2;
      switch (e2.commandType) {
        case I.CommandType.EvalStart:
          this.Assert(false === this.state.inExpressionEvaluation, "Already in expression evaluation?"), this.state.inExpressionEvaluation = true;
          break;
        case I.CommandType.EvalEnd:
          this.Assert(true === this.state.inExpressionEvaluation, "Not in expression evaluation mode"), this.state.inExpressionEvaluation = false;
          break;
        case I.CommandType.EvalOutput:
          if (this.state.evaluationStack.length > 0) {
            let t4 = this.state.PopEvaluationStack();
            if (!(t4 instanceof D)) {
              let e3 = new T(t4.toString());
              this.state.PushToOutputStream(e3);
            }
          }
          break;
        case I.CommandType.NoOp:
          break;
        case I.CommandType.Duplicate:
          this.state.PushEvaluationStack(this.state.PeekEvaluationStack());
          break;
        case I.CommandType.PopEvaluatedValue:
          this.state.PopEvaluationStack();
          break;
        case I.CommandType.PopFunction:
        case I.CommandType.PopTunnel:
          let t3 = e2.commandType == I.CommandType.PopFunction ? i.Function : i.Tunnel, n2 = null;
          if (t3 == i.Tunnel) {
            let t4 = this.state.PopEvaluationStack();
            n2 = a(t4, E), null === n2 && this.Assert(t4 instanceof D, "Expected void if ->-> doesn't override target");
          }
          if (this.state.TryExitFunctionEvaluationFromGame()) break;
          if (this.state.callStack.currentElement.type == t3 && this.state.callStack.canPop) this.state.PopCallStack(), n2 && (this.state.divertedPointer = this.PointerAtPath(n2.targetPath));
          else {
            let e3 = /* @__PURE__ */ new Map();
            e3.set(i.Function, "function return statement (~ return)"), e3.set(i.Tunnel, "tunnel onwards statement (->->)");
            let n3 = e3.get(this.state.callStack.currentElement.type);
            this.state.callStack.canPop || (n3 = "end of flow (-> END or choice)");
            let r3 = "Found " + e3.get(t3) + ", when expected " + n3;
            this.Error(r3);
          }
          break;
        case I.CommandType.BeginString:
          this.state.PushToOutputStream(e2), this.Assert(true === this.state.inExpressionEvaluation, "Expected to be in an expression when evaluating a string"), this.state.inExpressionEvaluation = false;
          break;
        case I.CommandType.BeginTag:
          this.state.PushToOutputStream(e2);
          break;
        case I.CommandType.EndTag:
          if (this.state.inStringEvaluation) {
            let t4 = [], e3 = 0;
            for (let n4 = this.state.outputStream.length - 1; n4 >= 0; --n4) {
              let i3 = this.state.outputStream[n4];
              e3++;
              let r3 = a(i3, I);
              if (null != r3) {
                if (r3.commandType == I.CommandType.BeginTag) break;
                this.Error("Unexpected ControlCommand while extracting tag from choice");
                break;
              }
              i3 instanceof T && t4.push(i3);
            }
            this.state.PopFromOutputStream(e3);
            let n3 = new m();
            for (let e4 of t4.reverse()) n3.Append(e4.toString());
            let i2 = new j(this.state.CleanOutputWhitespace(n3.toString()));
            this.state.PushEvaluationStack(i2);
          } else this.state.PushToOutputStream(e2);
          break;
        case I.CommandType.EndString: {
          let t4 = [], e3 = [], n3 = 0;
          for (let i3 = this.state.outputStream.length - 1; i3 >= 0; --i3) {
            let r3 = this.state.outputStream[i3];
            n3++;
            let s2 = a(r3, I);
            if (s2 && s2.commandType == I.CommandType.BeginString) break;
            r3 instanceof j && e3.push(r3), r3 instanceof T && t4.push(r3);
          }
          this.state.PopFromOutputStream(n3);
          for (let t5 of e3) this.state.PushToOutputStream(t5);
          t4 = t4.reverse();
          let i2 = new m();
          for (let e4 of t4) i2.Append(e4.toString());
          this.state.inExpressionEvaluation = true, this.state.PushEvaluationStack(new T(i2.toString()));
          break;
        }
        case I.CommandType.ChoiceCount:
          let r2 = this.state.generatedChoices.length;
          this.state.PushEvaluationStack(new _(r2));
          break;
        case I.CommandType.Turns:
          this.state.PushEvaluationStack(new _(this.state.currentTurnIndex + 1));
          break;
        case I.CommandType.TurnsSince:
        case I.CommandType.ReadCount:
          let l2 = this.state.PopEvaluationStack();
          if (!(l2 instanceof E)) {
            let t4 = "";
            l2 instanceof _ && (t4 = ". Did you accidentally pass a read count ('knot_name') instead of a target ('-> knot_name')?"), this.Error("TURNS_SINCE / READ_COUNT expected a divert target (knot, stitch, label name), but saw " + l2 + t4);
            break;
          }
          let o2, h2 = s(l2, E), u2 = a(this.ContentAtPath(h2.targetPath).correctObj, A);
          null != u2 ? o2 = e2.commandType == I.CommandType.TurnsSince ? this.state.TurnsSinceForContainer(u2) : this.state.VisitCountForContainer(u2) : (o2 = e2.commandType == I.CommandType.TurnsSince ? -1 : 0, this.Warning("Failed to find container for " + e2.toString() + " lookup at " + h2.targetPath.toString())), this.state.PushEvaluationStack(new _(o2));
          break;
        case I.CommandType.Random: {
          let t4 = a(this.state.PopEvaluationStack(), _), e3 = a(this.state.PopEvaluationStack(), _);
          if (null == e3 || e3 instanceof _ == false) return this.Error("Invalid value for minimum parameter of RANDOM(min, max)");
          if (null == t4 || t4 instanceof _ == false) return this.Error("Invalid value for maximum parameter of RANDOM(min, max)");
          if (null === t4.value) return d("maxInt.value");
          if (null === e3.value) return d("minInt.value");
          let n3 = t4.value - e3.value + 1;
          (!isFinite(n3) || n3 > Number.MAX_SAFE_INTEGER) && (n3 = Number.MAX_SAFE_INTEGER, this.Error("RANDOM was called with a range that exceeds the size that ink numbers can use.")), n3 <= 0 && this.Error("RANDOM was called with minimum as " + e3.value + " and maximum as " + t4.value + ". The maximum must be larger");
          let i2 = this.state.storySeed + this.state.previousRandom, r3 = new K(i2).next(), s2 = r3 % n3 + e3.value;
          this.state.PushEvaluationStack(new _(s2)), this.state.previousRandom = r3;
          break;
        }
        case I.CommandType.SeedRandom:
          let c2 = a(this.state.PopEvaluationStack(), _);
          if (null == c2 || c2 instanceof _ == false) return this.Error("Invalid value passed to SEED_RANDOM");
          if (null === c2.value) return d("minInt.value");
          this.state.storySeed = c2.value, this.state.previousRandom = 0, this.state.PushEvaluationStack(new D());
          break;
        case I.CommandType.VisitIndex:
          let p2 = this.state.VisitCountForContainer(this.state.currentPointer.container) - 1;
          this.state.PushEvaluationStack(new _(p2));
          break;
        case I.CommandType.SequenceShuffleIndex:
          let y2 = this.NextSequenceShuffleIndex();
          this.state.PushEvaluationStack(new _(y2));
          break;
        case I.CommandType.StartThread:
          break;
        case I.CommandType.Done:
          this.state.callStack.canPopThread ? this.state.callStack.PopThread() : (this.state.didSafeExit = true, this.state.currentPointer = k.Null);
          break;
        case I.CommandType.End:
          this.state.ForceEnd();
          break;
        case I.CommandType.ListFromInt:
          let v2 = a(this.state.PopEvaluationStack(), _), b2 = s(this.state.PopEvaluationStack(), T);
          if (null === v2) throw new S("Passed non-integer when creating a list element from a numerical value.");
          let w2 = null;
          if (null === this.listDefinitions) return d("this.listDefinitions");
          let P2 = this.listDefinitions.TryListGetDefinition(b2.value, null);
          if (!P2.exists) throw new S("Failed to find LIST called " + b2.value);
          {
            if (null === v2.value) return d("minInt.value");
            let t4 = P2.result.TryGetItemWithValue(v2.value, f.Null);
            t4.exists && (w2 = new N(t4.result, v2.value));
          }
          null == w2 && (w2 = new N()), this.state.PushEvaluationStack(w2);
          break;
        case I.CommandType.ListRange:
          let O2 = a(this.state.PopEvaluationStack(), C), x2 = a(this.state.PopEvaluationStack(), C), F2 = a(this.state.PopEvaluationStack(), N);
          if (null === F2 || null === x2 || null === O2) throw new S("Expected list, minimum and maximum for LIST_RANGE");
          if (null === F2.value) return d("targetList.value");
          let W2 = F2.value.ListWithSubRange(x2.valueObject, O2.valueObject);
          this.state.PushEvaluationStack(new N(W2));
          break;
        case I.CommandType.ListRandom: {
          let t4 = this.state.PopEvaluationStack();
          if (null === t4) throw new S("Expected list for LIST_RANDOM");
          let e3 = t4.value, n3 = null;
          if (null === e3) throw d("list");
          if (0 == e3.Count) n3 = new g();
          else {
            let t5 = this.state.storySeed + this.state.previousRandom, i2 = new K(t5).next(), r3 = i2 % e3.Count, a2 = e3.entries();
            for (let t6 = 0; t6 <= r3 - 1; t6++) a2.next();
            let s2 = a2.next().value, l3 = { Key: f.fromSerializedKey(s2[0]), Value: s2[1] };
            if (null === l3.Key.originName) return d("randomItem.Key.originName");
            n3 = new g(l3.Key.originName, this), n3.Add(l3.Key, l3.Value), this.state.previousRandom = i2;
          }
          this.state.PushEvaluationStack(new N(n3));
          break;
        }
        default:
          this.Error("unhandled ControlCommand: " + e2);
      }
      return true;
    }
    if (t2 instanceof L) {
      let e2 = t2, n2 = this.state.PopEvaluationStack();
      return this.state.variablesState.Assign(e2, n2), true;
    }
    if (t2 instanceof V) {
      let e2 = t2, n2 = null;
      if (null != e2.pathForCount) {
        let t3 = e2.containerForCount, i2 = this.state.VisitCountForContainer(t3);
        n2 = new _(i2);
      } else n2 = this.state.variablesState.GetVariableWithName(e2.name), null == n2 && (this.Warning("Variable not found: '" + e2.name + "'. Using default value of 0 (false). This can happen with temporary variables if the declaration hasn't yet been hit. Globals are always given a default value on load if a value doesn't exist in the save state."), n2 = new _(0));
      return this.state.PushEvaluationStack(n2), true;
    }
    if (t2 instanceof R) {
      let e2 = t2, n2 = this.state.PopEvaluationStack(e2.numberOfParameters), i2 = e2.Call(n2);
      return this.state.PushEvaluationStack(i2), true;
    }
    return false;
  }
  ChoosePathString(e2) {
    let n2 = !(arguments.length > 1 && void 0 !== arguments[1]) || arguments[1], r2 = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : [];
    if (this.IfAsyncWeCant("call ChoosePathString right now"), null !== this.onChoosePathString && this.onChoosePathString(e2, r2), n2) this.ResetCallstack();
    else if (this.state.callStack.currentElement.type == i.Function) {
      let t2 = "", n3 = this.state.callStack.currentElement.currentPointer.container;
      throw null != n3 && (t2 = "(" + n3.path.toString() + ") "), new Error("Story was running a function " + t2 + "when you called ChoosePathString(" + e2 + ") - this is almost certainly not not what you want! Full stack trace: \n" + this.state.callStack.callStackTrace);
    }
    this.state.PassArgumentsToEvaluationStack(r2), this.ChoosePath(new t(e2));
  }
  IfAsyncWeCant(t2) {
    if (this._asyncContinueActive) throw new Error("Can't " + t2 + ". Story is in the middle of a ContinueAsync(). Make more ContinueAsync() calls or a single Continue() call beforehand.");
  }
  ChoosePath(t2) {
    let e2 = !(arguments.length > 1 && void 0 !== arguments[1]) || arguments[1];
    this.state.SetChosenPath(t2, e2), this.VisitChangedContainersDueToDivert();
  }
  ChooseChoiceIndex(t2) {
    let e2 = this.currentChoices;
    this.Assert(t2 >= 0 && t2 < e2.length, "choice out of range");
    let n2 = e2[t2];
    return null !== this.onMakeChoice && this.onMakeChoice(n2), null === n2.threadAtGeneration ? d("choiceToChoose.threadAtGeneration") : null === n2.targetPath ? d("choiceToChoose.targetPath") : (this.state.callStack.currentThread = n2.threadAtGeneration, void this.ChoosePath(n2.targetPath));
  }
  HasFunction(t2) {
    try {
      return null != this.KnotContainerWithName(t2);
    } catch (t3) {
      return false;
    }
  }
  EvaluateFunction(t2) {
    let e2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : [], n2 = arguments.length > 2 && void 0 !== arguments[2] && arguments[2];
    if (null !== this.onEvaluateFunction && this.onEvaluateFunction(t2, e2), this.IfAsyncWeCant("evaluate a function"), null == t2) throw new Error("Function is null");
    if ("" == t2 || "" == t2.trim()) throw new Error("Function is empty or white space.");
    let i2 = this.KnotContainerWithName(t2);
    if (null == i2) throw new Error("Function doesn't exist: '" + t2 + "'");
    let r2 = [];
    r2.push(...this.state.outputStream), this._state.ResetOutput(), this.state.StartFunctionEvaluationFromGame(i2, e2);
    let a2 = new m();
    for (; this.canContinue; ) a2.Append(this.Continue());
    let s2 = a2.toString();
    this._state.ResetOutput(r2);
    let l2 = this.state.CompleteFunctionEvaluationFromGame();
    return null != this.onCompleteEvaluateFunction && this.onCompleteEvaluateFunction(t2, e2, s2, l2), n2 ? { returned: l2, output: s2 } : l2;
  }
  EvaluateExpression(t2) {
    let e2 = this.state.callStack.elements.length;
    this.state.callStack.Push(i.Tunnel), this._temporaryEvaluationContainer = t2, this.state.GoToStart();
    let n2 = this.state.evaluationStack.length;
    return this.Continue(), this._temporaryEvaluationContainer = null, this.state.callStack.elements.length > e2 && this.state.PopCallStack(), this.state.evaluationStack.length > n2 ? this.state.PopEvaluationStack() : null;
  }
  CallExternalFunction(t2, e2) {
    if (null === t2) return d("funcName");
    let n2 = this._externals.get(t2), r2 = null, a2 = void 0 !== n2;
    if (a2 && !n2.lookAheadSafe && this._state.inStringEvaluation && this.Error("External function " + t2 + ` could not be called because 1) it wasn't marked as lookaheadSafe when BindExternalFunction was called and 2) the story is in the middle of string generation, either because choice text is being generated, or because you have ink like "hello {func()}". You can work around this by generating the result of your function into a temporary variable before the string or choice gets generated: ~ temp x = ` + t2 + "()"), a2 && !n2.lookAheadSafe && null !== this._stateSnapshotAtLastNewline) return void (this._sawLookaheadUnsafeFunctionAfterNewline = true);
    if (!a2) {
      if (this.allowExternalFunctionFallbacks) return r2 = this.KnotContainerWithName(t2), this.Assert(null !== r2, "Trying to call EXTERNAL function '" + t2 + "' which has not been bound, and fallback ink function could not be found."), this.state.callStack.Push(i.Function, void 0, this.state.outputStream.length), void (this.state.divertedPointer = k.StartOf(r2));
      this.Assert(false, "Trying to call EXTERNAL function '" + t2 + "' which has not been bound (and ink fallbacks disabled).");
    }
    let l2 = [];
    for (let t3 = 0; t3 < e2; ++t3) {
      let t4 = s(this.state.PopEvaluationStack(), C).valueObject;
      l2.push(t4);
    }
    l2.reverse();
    let o2 = n2.function(l2), h2 = null;
    null != o2 ? (h2 = C.Create(o2), this.Assert(null !== h2, "Could not create ink value from returned object of type " + typeof o2)) : h2 = new D(), this.state.PushEvaluationStack(h2);
  }
  BindExternalFunctionGeneral(t2, e2) {
    let n2 = !(arguments.length > 2 && void 0 !== arguments[2]) || arguments[2];
    this.IfAsyncWeCant("bind an external function"), this.Assert(!this._externals.has(t2), "Function '" + t2 + "' has already been bound."), this._externals.set(t2, { function: e2, lookAheadSafe: n2 });
  }
  TryCoerce(t2) {
    return t2;
  }
  BindExternalFunction(t2, e2) {
    let n2 = arguments.length > 2 && void 0 !== arguments[2] && arguments[2];
    this.Assert(null != e2, "Can't bind a null function"), this.BindExternalFunctionGeneral(t2, ((t3) => {
      this.Assert(t3.length >= e2.length, "External function expected " + e2.length + " arguments");
      let n3 = [];
      for (let e3 = 0, i2 = t3.length; e3 < i2; e3++) n3[e3] = this.TryCoerce(t3[e3]);
      return e2.apply(null, n3);
    }), n2);
  }
  UnbindExternalFunction(t2) {
    this.IfAsyncWeCant("unbind an external a function"), this.Assert(this._externals.has(t2), "Function '" + t2 + "' has not been bound."), this._externals.delete(t2);
  }
  ValidateExternalBindings() {
    let t2 = null, e2 = null, n2 = arguments[1] || /* @__PURE__ */ new Set();
    if (arguments[0] instanceof A && (t2 = arguments[0]), arguments[0] instanceof p && (e2 = arguments[0]), null === t2 && null === e2) if (this.ValidateExternalBindings(this._mainContentContainer, n2), this._hasValidatedExternals = true, 0 == n2.size) this._hasValidatedExternals = true;
    else {
      let t3 = "Error: Missing function binding for external";
      t3 += n2.size > 1 ? "s" : "", t3 += ": '", t3 += Array.from(n2).join("', '"), t3 += "' ", t3 += this.allowExternalFunctionFallbacks ? ", and no fallback ink function found." : " (ink fallbacks disabled)", this.Error(t3);
    }
    else if (null != t2) {
      for (let e3 of t2.content) {
        null != e3 && e3.hasValidName || this.ValidateExternalBindings(e3, n2);
      }
      for (let [, e3] of t2.namedContent) this.ValidateExternalBindings(a(e3, p), n2);
    } else if (null != e2) {
      let t3 = a(e2, F);
      if (t3 && t3.isExternal) {
        let e3 = t3.targetPathString;
        if (null === e3) return d("name");
        if (!this._externals.has(e3)) if (this.allowExternalFunctionFallbacks) {
          this.mainContentContainer.namedContent.has(e3) || n2.add(e3);
        } else n2.add(e3);
      }
    }
  }
  ObserveVariable(t2, e2) {
    if (this.IfAsyncWeCant("observe a new variable"), null === this._variableObservers && (this._variableObservers = /* @__PURE__ */ new Map()), !this.state.variablesState.GlobalVariableExistsWithName(t2)) throw new Error("Cannot observe variable '" + t2 + "' because it wasn't declared in the ink story.");
    this._variableObservers.has(t2) ? this._variableObservers.get(t2).push(e2) : this._variableObservers.set(t2, [e2]);
  }
  ObserveVariables(t2, e2) {
    for (let n2 = 0, i2 = t2.length; n2 < i2; n2++) this.ObserveVariable(t2[n2], e2[n2]);
  }
  RemoveVariableObserver(t2, e2) {
    if (this.IfAsyncWeCant("remove a variable observer"), null !== this._variableObservers) {
      if (null != e2) {
        if (this._variableObservers.has(e2)) if (null != t2) {
          let n2 = this._variableObservers.get(e2);
          null != n2 && (n2.splice(n2.indexOf(t2), 1), 0 === n2.length && this._variableObservers.delete(e2));
        } else this._variableObservers.delete(e2);
      } else if (null != t2) {
        let e3 = this._variableObservers.keys();
        for (let n2 of e3) {
          let e4 = this._variableObservers.get(n2);
          null != e4 && (e4.splice(e4.indexOf(t2), 1), 0 === e4.length && this._variableObservers.delete(n2));
        }
      }
    }
  }
  VariableStateDidChangeEvent(t2, e2) {
    if (null === this._variableObservers) return;
    let n2 = this._variableObservers.get(t2);
    if (void 0 !== n2) {
      if (!(e2 instanceof C)) throw new Error("Tried to get the value of a variable that isn't a standard type");
      let i2 = s(e2, C);
      for (let e3 of n2) e3(t2, i2.valueObject);
    }
  }
  get globalTags() {
    return this.TagsAtStartOfFlowContainerWithPathString("");
  }
  TagsForContentAtPath(t2) {
    return this.TagsAtStartOfFlowContainerWithPathString(t2);
  }
  TagsAtStartOfFlowContainerWithPathString(e2) {
    let n2 = new t(e2), i2 = this.ContentAtPath(n2).container;
    if (null === i2) return d("flowContainer");
    for (; ; ) {
      let t2 = i2.content[0];
      if (!(t2 instanceof A)) break;
      i2 = t2;
    }
    let r2 = false, s2 = null;
    for (let t2 of i2.content) {
      let e3 = a(t2, I);
      if (null != e3) e3.commandType == I.CommandType.BeginTag ? r2 = true : e3.commandType == I.CommandType.EndTag && (r2 = false);
      else {
        if (!r2) break;
        {
          let e4 = a(t2, T);
          null !== e4 ? (null === s2 && (s2 = []), null !== e4.value && s2.push(e4.value)) : this.Error("Tag contained non-text content. Only plain text is allowed when using globalTags or TagsAtContentPath. If you want to evaluate dynamic content, you need to use story.Continue().");
        }
      }
    }
    return s2;
  }
  BuildStringOfHierarchy() {
    let t2 = new m();
    return this.mainContentContainer.BuildStringOfHierarchy(t2, 0, this.state.currentPointer.Resolve()), t2.toString();
  }
  BuildStringOfContainer(t2) {
    let e2 = new m();
    return t2.BuildStringOfHierarchy(e2, 0, this.state.currentPointer.Resolve()), e2.toString();
  }
  NextContent() {
    if (this.state.previousPointer = this.state.currentPointer.copy(), !this.state.divertedPointer.isNull && (this.state.currentPointer = this.state.divertedPointer.copy(), this.state.divertedPointer = k.Null, this.VisitChangedContainersDueToDivert(), !this.state.currentPointer.isNull)) return;
    if (!this.IncrementContentPointer()) {
      let t2 = false;
      this.state.callStack.CanPop(i.Function) ? (this.state.PopCallStack(i.Function), this.state.inExpressionEvaluation && this.state.PushEvaluationStack(new D()), t2 = true) : this.state.callStack.canPopThread ? (this.state.callStack.PopThread(), t2 = true) : this.state.TryExitFunctionEvaluationFromGame(), t2 && !this.state.currentPointer.isNull && this.NextContent();
    }
  }
  IncrementContentPointer() {
    let t2 = true, e2 = this.state.callStack.currentElement.currentPointer.copy();
    if (e2.index++, null === e2.container) return d("pointer.container");
    for (; e2.index >= e2.container.content.length; ) {
      t2 = false;
      let n2 = a(e2.container.parent, A);
      if (n2 instanceof A == false) break;
      let i2 = n2.content.indexOf(e2.container);
      if (-1 == i2) break;
      if (e2 = new k(n2, i2), e2.index++, t2 = true, null === e2.container) return d("pointer.container");
    }
    return t2 || (e2 = k.Null), this.state.callStack.currentElement.currentPointer = e2.copy(), t2;
  }
  TryFollowDefaultInvisibleChoice() {
    let t2 = this._state.currentChoices, e2 = t2.filter(((t3) => t3.isInvisibleDefault));
    if (0 == e2.length || t2.length > e2.length) return false;
    let n2 = e2[0];
    return null === n2.targetPath ? d("choice.targetPath") : null === n2.threadAtGeneration ? d("choice.threadAtGeneration") : (this.state.callStack.currentThread = n2.threadAtGeneration, null !== this._stateSnapshotAtLastNewline && (this.state.callStack.currentThread = this.state.callStack.ForkThread()), this.ChoosePath(n2.targetPath, false), true);
  }
  NextSequenceShuffleIndex() {
    let t2 = a(this.state.PopEvaluationStack(), _);
    if (!(t2 instanceof _)) return this.Error("expected number of elements in sequence for shuffle index"), 0;
    let e2 = this.state.currentPointer.container;
    if (null === e2) return d("seqContainer");
    if (null === t2.value) return d("numElementsIntVal.value");
    let n2 = t2.value, i2 = s(this.state.PopEvaluationStack(), _).value;
    if (null === i2) return d("seqCount");
    let r2 = i2 / n2, l2 = i2 % n2, o2 = e2.path.toString(), h2 = 0;
    for (let t3 = 0, e3 = o2.length; t3 < e3; t3++) h2 += o2.charCodeAt(t3) || 0;
    let u2 = h2 + r2 + this.state.storySeed, c2 = new K(Math.floor(u2)), p2 = [];
    for (let t3 = 0; t3 < n2; ++t3) p2.push(t3);
    for (let t3 = 0; t3 <= l2; ++t3) {
      let e3 = c2.next() % p2.length, n3 = p2[e3];
      if (p2.splice(e3, 1), t3 == l2) return n3;
    }
    throw new Error("Should never reach here");
  }
  Error(t2) {
    let e2 = arguments.length > 1 && void 0 !== arguments[1] && arguments[1], n2 = new S(t2);
    throw n2.useEndLineNumber = e2, n2;
  }
  Warning(t2) {
    this.AddError(t2, true);
  }
  AddError(t2) {
    let e2 = arguments.length > 1 && void 0 !== arguments[1] && arguments[1], n2 = arguments.length > 2 && void 0 !== arguments[2] && arguments[2], i2 = this.currentDebugMetadata, r2 = e2 ? "WARNING" : "ERROR";
    if (null != i2) {
      let e3 = n2 ? i2.endLineNumber : i2.startLineNumber;
      t2 = "RUNTIME " + r2 + ": '" + i2.fileName + "' line " + e3 + ": " + t2;
    } else t2 = this.state.currentPointer.isNull ? "RUNTIME " + r2 + ": " + t2 : "RUNTIME " + r2 + ": (" + this.state.currentPointer + "): " + t2;
    this.state.AddError(t2, e2), e2 || this.state.ForceEnd();
  }
  Assert(t2) {
    let e2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : null;
    if (0 == t2) throw null == e2 && (e2 = "Story assert"), new Error(e2 + " " + this.currentDebugMetadata);
  }
  get currentDebugMetadata() {
    let t2, e2 = this.state.currentPointer;
    if (!e2.isNull && null !== e2.Resolve() && (t2 = e2.Resolve().debugMetadata, null !== t2)) return t2;
    for (let n2 = this.state.callStack.elements.length - 1; n2 >= 0; --n2) if (e2 = this.state.callStack.elements[n2].currentPointer, !e2.isNull && null !== e2.Resolve() && (t2 = e2.Resolve().debugMetadata, null !== t2)) return t2;
    for (let e3 = this.state.outputStream.length - 1; e3 >= 0; --e3) {
      if (t2 = this.state.outputStream[e3].debugMetadata, null !== t2) return t2;
    }
    return null;
  }
  get mainContentContainer() {
    return this._temporaryEvaluationContainer ? this._temporaryEvaluationContainer : this._mainContentContainer;
  }
};
Q.inkVersionCurrent = 21, (function(t2) {
  var e2;
  (e2 = t2.OutputStateChange || (t2.OutputStateChange = {}))[e2.NoChange = 0] = "NoChange", e2[e2.ExtendedBeyondNewline = 1] = "ExtendedBeyondNewline", e2[e2.NewlineRemoved = 2] = "NewlineRemoved";
})(Q || (Q = {}));
export {
  g as InkList,
  Q as Story
};
//# sourceMappingURL=inkjs.js.map
