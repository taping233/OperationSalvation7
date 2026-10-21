/// <reference path="./runtime-env.d.ts" />
// Runtime baseline resolves this declaration while still checking sdt-facade.js
// as an explicit root. Existing strict projects keep their original import graph.
declare const SDT: RuntimeFacade;
export default SDT;
export declare function sdtDefine<T>(name: keyof RuntimeFacade, value: T): T;
