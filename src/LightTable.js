/**
 * 简易Table控件
 * Copyright 2016 Baidu Inc. All rights reserved.
 *
 * @file 控件实现
 * @author otakustay
 */

import Control from 'esui/Control';
/* eslint-disable no-unused-vars */
import Tip from 'esui/Tip';
/* eslint-enable no-unused-vars */
import ui from 'esui';
import $ from 'jquery';
import u from 'underscore';
import engine from './templateEngine';
import defaults from './defaults';

let camelize = str => str.replace(/[A-Z]/g, char => '-' + char.toLowerCase());

export default class LightTable extends Control {
    get type() {
        return 'LightTable';
    }

    get styleType() {
        return 'light-table';
    }

    get classPrefix() {
        return ui.getConfig('uiClassPrefix') + '-' + this.styleType;
    }

    constructor(options) {
        super(options);

        this.helper.setTemplateEngine(engine);
    }

    initOptions(options) {
        let properties = u.defaults({}, options, defaults);
        this.setProperties(properties);
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
            let previous = changesIndex.datasource.oldValue;
            let current = changesIndex.datasource.newValue;
            this.renderDatasourceChange(previous, current);
        }

        // `selectMode`和`sortMode`不得修改
        if (changesIndex.selectedIndex) {
            // 由于`datasource`变化会导致`selectedIndex`一起变化，所以当2个同时设置时，需要把这个值恢复过去
            this.selectedIndex = changesIndex.selectedIndex.newValue;
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

    renderDatasourceChange(previous, current) {
        // 先把选中的项存起来，然后选中效果全部清除，等更新后再恢复选中状态，
        // 如果被选中的某一行被更新了，这一行的选中状态会丢失，这是正常的
        let selectedItems = u.map(this.selectedIndex, i => previous[i]);

        // 取消掉上次更新的高亮
        this.query('.row').removeClass(this.helper.getPrimaryClassName('row-just-updated'));

        // 一个非常简单的提高效率的算法，主要解决2个常见场景：
        //
        // 1. 原数据源中间某几项被更新，其它项未更新
        // 2. 数据源前或后插入了若干项（只可在一个方向插入，两端都有插入则完全重渲染）

        let sharedCount = Math.min(previous.length, current.length);
        // 先试下第一个元素是否相同，如果不同则可能是在头部插入了，此时反过来遍历，
        // 但如果尾巴也不同，就干脆全部重刷了
        if (u.first(previous) !== u.first(current) && u.last(previous) === u.last(current)) {
            for (let i = 0; i < sharedCount; i++) {
                let previousIndex = previous.length - i - 1;
                let currentIndex = current.length - i - 1;
                let previousItem = previous[previousIndex];
                let currentItem = current[currentIndex];

                if (previousItem !== currentItem) {
                    this.renderRow(currentItem, 'replace', previousIndex);
                }
            }

            if (current.length > previous.length) {
                // 补上几个
                let prependItems = u.first(current, current.length - previous.length).reverse();
                u.each(prependItems, item => this.renderRow(item, 'prepend'));
            }
            else if (current.length < previous.length) {
                // 删除几个
                let removeIndex = u.range(0, previous.length - current.length);
                u.each(removeIndex, index => this.renderRow(null, 'remove', index));
            }
        }
        else {
            for (let i = 0; i < sharedCount; i++) {
                let previousItem = previous[i];
                let currentItem = current[i];

                if (previousItem !== currentItem) {
                    this.renderRow(currentItem, 'replace', i);
                }
            }

            if (current.length > previous.length) {
                // 补上几个
                let appendItems = u.last(current, current.length - previous.length);
                u.each(appendItems, item => this.renderRow(item, 'append'));
            }
            else if (current.length < previous.length) {
                // 删除几个
                let removeIndex = u.range(current.length, previous.length);
                u.each(removeIndex, index => this.renderRow(null, 'remove', index));
            }
        }

        let restoredSelectedIndex = u.chain(selectedItems)
            .map(item => u.indexOf(current, item))
            .filter(index => index >= 0)
            .value();
        this.set('selectedIndex', restoredSelectedIndex);

        this.syncNoData();
    }

    renderRow(item, replaceType, index) {
        if (replaceType === 'remove') {
            this.query(`.row:eq(${index})`).remove();
            return;
        }

        let data = u.extend(
            {row: this.computeRowData(item)},
            this.computePropertyData()
        );
        let rowElement = $(this.helper.renderTemplate('row', data));

        switch (replaceType) {
            case 'replace':
                this.query(`.row:eq(${index})`).replaceWith(rowElement);
                break;
            case 'prepend':
                this.query('tbody').prepend(rowElement);
                break;
            case 'append':
                this.query('tbody').append(rowElement);
                break;
        }

        this.initUICells(rowElement);
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
                let rowData = this.computeRowData(item);
                rows.push(rowData);
                return rows;
            },
            []
        );
        let properties = this.computePropertyData();
        return u.extend(properties, {rows});
    }

    computePropertyData() {
        return u.pick(this, 'fields', 'datasource', 'selectMode', 'classPrefix', 'noDataHTML');
    }

    computeRowData(item) {
        let cells = u.reduce(
            this.fields,
            (cells, field) => {
                let content = String(field.content(item));
                let className = this.helper.getPrimaryClassName('cell-for-' + camelize(field.field));
                if (field.contentType === 'ui') {
                    className += ' ' + this.helper.getPrimaryClassName('cell-ui');
                }

                cells.push({item, content, field, className});
                return cells;
            },
            []
        );
        return {item, cells};
    }

    syncSort() {
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

    syncNoData() {
        this.query('#no-data').remove();

        if (!this.datasource.length) {
            let html = this.helper.renderTemplate('noData', u.pick(this, 'noDataHTML'));
            this.query('#table').after(html);
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
