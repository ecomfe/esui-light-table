import Control from 'esui/Control';
import Tip from 'esui/Tip';
import ui from 'esui';
import $ from 'jquery';
import u from 'underscore';
import {Engine} from 'etpl';
import TEMPLATE from 'text!./LightTable.tpl.html';

let engine = new Engine();
engine.addFilter('camelize', str => str.replace(/[A-Z]/g, char => '-' + char.toLowerCase()));
engine.parse(TEMPLATE);

export {engine};

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

    buildSelector(selector) {
        return selector.replace(
            /([\.#])([\w\-]+)/g,
            (selector, hint, part) => {
                if (hint === '.') {
                    return '.' + this.helper.getPrimaryClassName(part);
                }

                return '#' + this.helper.getId(part);
            }
        );
    }

    query(selector) {
        return $(this.main).find(this.buildSelector(selector));
    }

    initEvents() {
        let on = (event, selector, handler) => {
            let parsedSelector = this.buildSelector(selector);
            this.helper.addDOMEvent(this.main, event, parsedSelector, handler);
        };

        on('change', '#check-all', this.onSelectAll);
        on('change', '.row-select', this.onSelectRow);
        on('click', '.sort-label', this.onSort);
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
        this.initChildren(this.query('thead').get(0));
        this.initUICells();
        this.syncSort();
        this.syncSelection();
    }

    renderBody() {
        // TODO: 实现
    }

    initUICells(row) {
        let classSelector = this.buildSelector('.cell-ui');
        let cells = $(row || this.main).find(classSelector);
        u.each(cells, this.initChildren, this);
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
        let switchSortTo = (selector, type) => {
            let sortClassName = type ? 'ui-icon-sort-' + type : 'ui-icon-sort';
            this.query(selector)
                .removeClass('ui-icon-sort ui-icon-sort-asc ui-icon-sort-desc')
                .addClass(sortClassName);
        };

        // 恢复所有字段排序效果
        switchSortTo('.sort-label', null);

        // 设置单一字段排序
        if (this.orderBy) {
            let order = this.order || 'asc';
            switchSortTo(`.head-cell-for-${this.orderBy} .sort-label`, order);
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

    onSelectAll() {
        let checkAll = this.query('#check-all').prop('checked');
        if (checkAll) {
            let allIndex = u.range(this.datasource.length);
            this.set('selectedIndex', allIndex);
        }
        else {
            this.set('selectedIndex', []);
        }

        this.fire('select');
    }

    onSelectRow(e) {
        let target = $(e.target);
        let index = target.closest('tr').index();

        if (this.selectMode === 'single') {
            this.set('selectedIndex', index);
        }
        else {
            let checked = target.prop('checked');
            let selectedIndex = checked ? [...this.selectedIndex, index].sort() : u.without(this.selectedIndex, index);
            this.set('selectedIndex', selectedIndex);
        }

        this.fire('select');
    }

    onSort(e) {
        let target = $(e.target);
        let fieldIndex = target.closest('th').index();
        if (this.selectMode !== 'none') {
            fieldIndex--;
        }
        let field = this.fields[fieldIndex];
        let order = target.hasClass('ui-icon-sort-asc') ? 'desc' : 'asc';
        this.setProperties({order: order, orderBy: field.field});
        this.fire('sort');
    }
}

ui.register(LightTable);
