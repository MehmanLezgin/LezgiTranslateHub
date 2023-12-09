const settings = require("./settings");

const roundNum = (num, d = 10) => Math.round(num * d) / d;

const calcExpForLevel = (lvl) => {
    if (lvl < 1) lvl = 1;
    return 8 + (lvl-1) * settings.EXP_PER_LVL_COEF;
};

module.exports = { roundNum, calcExpForLevel };