module.exports = {
 forbidden: [
 {name:'module-cycle-review',severity:'warn',from:{path:'^game/src/'},to:{circular:true}},
 {name:'core-to-ui-review',severity:'warn',from:{path:'^game/src/battle/core/'},to:{path:'^game/src/(ui/|battle/view/|hub/|run/)'}},
 {name:'production-to-dev-package',severity:'error',from:{path:'^game/src/'},to:{dependencyTypes:['npm-dev']}},
 {name:'unresolved-import',severity:'warn',from:{path:'^game/src/'},to:{couldNotResolve:true}}
 ],
 options:{doNotFollow:{path:'node_modules'},exclude:{path:'game/src/generated/'}}
};
