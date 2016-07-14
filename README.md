# esui-light-table

这是一个非常轻量级的表格控件的实现，相比于`esui.Table`控件精简了大量的功能和代码，布局交由HTML原生`<table>`元素完成，同时提供了排序、选择等必要功能，供简单场景使用。

控件仅支持IE9以上环境使用，且使用ES2015+编写而成，请自行配置`babel`编译代码，使用`es2015`这个`preset`足够。

同时使用该控件请保证有AMD的`text`插件，且使用`text!`可直接使用该插件（这通常需要在`require.config`中的`paths`属性配置）。

## 查看示例

运行以下命令安装依赖并打开服务器：

```shell
edp import
npm install
npm run server
```

随后打开 http://localhost:8848/demo/LightTable.html 即可。

## 不可变属性

以下属性仅支持创建控件时给定相应的值，不支持在控件渲染后通过`set`或`setProperties`变更：

- `{string} selectMode`：取值为`"none"`、`"single"`和`"multiple"`，默认为`"none"`，控制表格的选择方式。
- `{string} noDataHTML`：表格无数据时显示的HTML片段，此片段不会被进行HTML编码，需要使用者进行XSS处理。

## 可变属性

以下属性可在控件渲染后更新值：

- `{Field[]} fields`：表格的列配置，具体结构参考下文。如果更新这个属性，整个表格会重新渲染，不会采取任何优化手段。
- `{Object[]} datasource`：数据源，任意结构的对象数组。
- `{string} orderBy`：排序的字段，需要与`fields`中某一项的`field`属性对应，值为`null`则表示不排序。
- `{string} order`：排序方式，支持`"asc"`或`"desc"`，如果`orderBy`不为`null`，则该属性也不能为`null`。
- `{number | number[]} selectedIndex`：选中行的索引，类型与`selectMode`属性有关，当其值为`"single"`时类型为`number`，为`"multiple"`时类型为`number[]`。

其中`Field`列配置支持以下属性：

- `{string} field`：该列对应的字段名，事实上不一定要求`datasource`中有该字段，可以将之当作`name`的效果来用。不同列的`field`字段不能重复，重复可能产生不可预期的行为。
- `{string} title`：列的标题。
- `{string} tip`：列的提示内容，可选，如果有该属性则会在标题后生成一个`esui.Tip`控件显示提示内容。
- `{boolean} sortable`：控制列是否可排序，默认为`false`。
- `{string} contentType`：列的取值类型，可为`"text"`、`"html"`或`"ui"`，默认为`"text"`，各值作用如下：
    - `"text"`：内容会被HTML编码。
    - `"pre"`：内容会被HTML编码，并在一个`<pre>`标签中输出。
    - `"html"`：内容不会被HTML编码，直接输出。
    - `"ui"`：内容不被HTML编码直接输出，且支持生成`esui`控件。
- `{Function(Object): string} content`：生成内容的函数，被调用时接收当前行的数据项为参数，无`this`。

## 事件

以下为`LightTable`提供的事件，如无特殊说明，所有事件的`Event`对象中没有除`target`等默认属性以外的属性，且所有事件**仅在用户操作时触发**，程序调用（如`.set`）不会触发事件：

- `sort`：排序改变时触发。
- `select`：选中行改变时触发。

## 数据更新

`LightTable`采用Immutable的理念实现，因此相关的属性如需要更新，必须使之变为引用不同的对象，即以下代码**无法**正常工作：

```js
let datasource = table.get('datasource');
datasource.push(newItem);
table.set('datasource', datasource);
```

这一特点同样适用于`fields`属性。

更进一步地，更新其中一项也必须让这这一项变为不同引用的对象，因此以下代码同样**无法**正常工作：

```js
let datasource = table.get('datasource');
datasource[1].name = 'new name';
table.set('datasource', datasource);
```

正确的做法为：

```js
let datasource = u.clone(table.get('datasource'));
let newItem = u.clone(datasource[1]);
newItem.name = 'new name';
datasource[1] = newItem;
table.set('datasource', datasource);
```

当然这样确实相对麻烦，推荐使用[diffy-update](https://github.com/ecomfe/diffy-update)库进行更新：

```js
import {set} from 'diffy-update';

let datasource = set(table.get('datasource'), ['1', 'name'], 'new name');
table.set('datasource', datasource);
```

具体使用方式请看[diffy-update](https://github.com/ecomfe/diffy-update)库的文档。

在数据更新后，被判断为更新过（引用不同）的项的选中状态将被取消（哪怕你只改了某一个属性，但是`LightTable`不负责通过某个属性判断是不是同一项），其它未更新的项的选中状态会被保留。

Immutable有助于`LightTable`在更新`datasource`减少更新的DOM数量，现实现使用了一个简单的比较更新，可在以下场景下将更新量减小到最少：

1. 在头部或尾部插入了若干项（仅能在一端插入，两端都有插入的情况下将完全重绘）。
2. 更新了其中的若干项。

## 样式扩展

`LightTable`控件的样式名称为`light-table`，这与`esui`的默认规则（`lighttable`）不同，是有意为之。以下列出的所有的`id`和`class`在实际使用时都需要加上相应前缀，默认为`ui-light-table-`：

- `#head`：表格的`<thead>`元素，往往在表头固定之类的时候可以使用。
- `.head-row`：表头中的`<tr>`元素。
- `.head-select-cell`：表头用于全选的单元格。
- `.head-cell`：表头中的单元格。
- `.head-cell-for-${field}`：对应于某个字段的表头单元格，`${field}`对应于`fields`配置中的`field`属性。
- `.head-title`：放置表头文本的元素。
- `.sort-label`：用于排序的小图标，同时使用`ui-icon-sort`、`ui-icon-sort-asc`和`ui-icon-sort-desc`这三个`class`控制排序方向。
- `#check-all`：用于全选的`input[type="checkbox"]`元素。
- `.row`：表格数据行。
- `.row-select`：用于选择行的`input`元素，根据`selectMode`取值可能为`radio`或`checkbox`。
- `.cell`：数据单元格。
- `.cell-ui`：支持`esui`控件的数据单元格。
- `.cell-for-${field}`：对应于某个字段的数据单元格，`${field}`对应于`fields`配置中的`field`属性，**需要配置某一列的宽度、换行等样式，可以使用这个选择器**。
- `#no-data`：无数据时显示`noDataHTML`的元素。
