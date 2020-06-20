exports.objectHasKeys = (target, ...keys) => {
    var t = target;
    while (key = keys.shift()) {
        if (!(key in t)) {
            return false;
        }
        t = target[key];
    }

    return true;
}
