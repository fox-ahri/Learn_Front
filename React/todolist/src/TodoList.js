import React, { Component, Fragment } from 'react'
import './TodoList.css'

class TodoList extends Component {

    constructor(props) {
        super(props);
        this.state = {
            inputValue: '',
            list: []
        }
    }

    render() {
        return (
            <Fragment>
                {/** 多行注释 */}
                {
                    // 单行注释
                }
                <div>
                    <label htmlFor="input">点击输入</label>
                    <input id='input' className='input' type='text' value={this.state.inputValue} onChange={this.handleInputChange.bind(this)} />
                    <button onClick={this.handleBtnClick.bind(this)}>提交</button>
                </div>
                <ul>
                    {
                        this.state.list.map((item, index) => {
                            return <li key={index} onClick={this.handleItemDelete.bind(this, index)} dangerouslySetInnerHTML={{ __html: item }}></li>
                        })
                    }
                </ul>
            </Fragment>
        )
    }

    handleInputChange(e) {
        this.setState({
            inputValue: e.target.value
        })
    }

    handleBtnClick() {
        this.setState({
            list: [...this.state.list, this.state.inputValue],
            inputValue: ''
        })
    }

    handleItemDelete(index) {
        const list = [...this.state.list];
        list.splice(index, 1);
        this.setState({
            list: list
        })
    }
}

export default TodoList;