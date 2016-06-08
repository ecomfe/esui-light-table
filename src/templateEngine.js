/**
 * 简易Table控件
 * Copyright 2016 Baidu Inc. All rights reserved.
 *
 * @file 控件用的模板引擎
 * @author otakustay
 */

import {Engine} from 'etpl';
import TEMPLATE from 'text!./LightTable.tpl.html';

let engine = new Engine();
engine.parse(TEMPLATE);
engine.addFilter('camelize', str => str.replace(/[A-Z]/g, char => '-' + char.toLowerCase()));

export default engine;
