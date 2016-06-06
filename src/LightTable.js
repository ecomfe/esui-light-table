import Control from 'esui/Control';
import ui from 'esui';
import $ from 'jquery';
import u from 'underscore';
import {Engine} from 'etpl';
import TEMPLATE from 'text!./LightTable.tpl.html';

let engine = new Engine();
engine.addFilter('camelize', str => str.replace(/[A-Z]/g, char => '-' + char.toLowerCase()));
engine.parse(TEMPLATE);

export default class LightTable extends Control {
    get type() {
        return 'LightTable';
    }

    get styleType() {
        return 'light-table';
    }

    get classPrefix() {
        return ui.getConfig('uiClassPrefix') + '-' + this.styleType
    }

    constructor(options) {
        super(options);

        this.helper.setTemplateEngine(engine);
    }

    repaint(changes, changesIndex) {
        super.repaint(changes, changesIndex);

        // 第一次渲染或者列配置变动了
        if (!changesIndex || changesIndex.fields) {
            this.renderAll();
            return;
        }

        if (changesIndex.datasource) {
            this.renderBody();
        }

        // `selectMode`和`sortMode`不得修改
        if (changesIndex.selectedIndex) {
            this.syncSelection();
        }

        if (changesIndex.order || changesIndex.orderBy) {
            this.syncSort();
        }
    }

    renderAll() {
        let viewData = this.computeViewData();
        this.main.innerHTML = this.helper.renderTemplate('main', viewData);
        this.syncSort();
        this.syncSelection();
    }

    computeViewData() {
        let rows = u.reduce(
            this.datasource,
            (rows, item) => {
                let cells = u.reduce(
                    this.fields,
                    (cells, field) => {
                        let content = String(field.content(item));
                        cells.push({item, content, field});
                        return cells;
                    },
                    []
                );

                rows.push({item, cells});
                return rows;
            },
            []
        );
        let properties = u.pick(this, 'fields', 'datasource', 'selectMode', 'classPrefix');
        return u.extend(properties, {rows});
    }

    syncSort() {
        let sortLabelClass = '.' + this.helper.getPrimaryClassName('sort-label');
        let switchSortTo = (query, type) => {
            let sortClassName = type ? 'ui-icon-sort-' + type : 'ui-icon-sort';
            query.removeClass('ui-icon-sort ui-icon-sort-asc ui-icon-sort-desc').addClass(sortClassName);
        };

        // 恢复所有字段排序效果
        switchSortTo($(this.main).find(sortLabelClass), null);

        // 设置单一字段排序
        if (this.order) {
            let headCell = $(this.main).find(`.${this.classPrefix}-head-cell-for-${this.order}`);
            let orderBy = this.orderBy || 'asc';
            var sortLabel = headCell.find(sortLabelClass);
            switchSortTo(sortLabel, orderBy);
        }
    }

    syncSelection() {
        if (!this.selectedIndex) {
            return;
        }

        let inputs = $(this.main).find('.' + this.helper.getPrimaryClassName('row-select'));
        // 先恢复所有
        inputs.prop('checked', false);

        if (this.selectMode === 'single') {
            inputs.eq(this.selectedIndex).prop('checked', true);
        }
        else if (this.selectMode === 'multiple') {
            // 选上选中的
            inputs.filter(i => u.contains(this.selectedIndex, i)).prop('checked', true);

            // 判断全选
            let isAllChecked = u.all(inputs, input => input.checked);
            $(this.helper.getPart('check-all')).prop('checked', isAllChecked);
        }
    }
}

ui.register(LightTable);
