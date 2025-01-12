import React from 'react';

import PropTypes from 'prop-types';

import './inventory.scss';

export const Inventory = ({ ...props }) => {
  const mockItems = [
    { id: 1, name: 'Item 1', icon: 'icon1.png', amount: 1 },
    { id: 2, name: 'Item 2', icon: 'icon2.png', amount: 2 },
    { id: 3, name: 'Item 3', icon: 'icon3.png', amount: 3 },
    { id: 4, name: 'Item 4', icon: 'icon4.png', amount: 4 },
    { id: 5, name: 'Item 5', icon: 'icon5.png', amount: 5 },
    { id: 6, name: 'Item 6', icon: 'icon6.png', amount: 6 },
  ];
  const numItemSlots = 20;
  const slots = Array.from({ length: numItemSlots }, () => null);
  return (
    <div id="Inventory">
      <div className="titlebar">
        <div className="left">
          <span className="text" data-text="106"><img src="https://dex-ro.com/static/img/inventory-board.png" alt="Inventory" /></span>
        </div>
        <div className="right">
          <button className="base mini"></button>
          <button className="base close"></button>
        </div>
      </div>
      <div className="overlay"></div>
      <div className="panel">
        <div className="inventory-layout">
          <div className="tabs-column">
            <div className="tabs">
              <button className="item tab">Items</button>
              <button className="equip tab">Equipment</button>
              <button className="etc tab">Misc</button>
            </div>
          </div>
          <div className="main-column">
            <div className="container">
              <div className="ff_bugfix">
                {/* <div className="hide"></div> */}
                <div className="content">
                  <div className="inventory-grid">
                    {
                      slots.map((_, idx) => {
                        const item = mockItems[idx];
                        return (
                          <div key={idx} className="item" data-index={idx} draggable="true">
                            {
                              item && (
                                <>
                                  <div className="icon" style={{ backgroundImage: `url(https://dex-ro.com/static/img/dummy-item.png)` }} />
                                  <div className="amount">
                                    <span className="count">{item.amount}</span>
                                  </div>
                                </>
                              )
                            }
                          </div>
                        )
                      })
                    }
                  </div>
                  <div className="footer">
                    <button className="extend"></button><div className="cnt">6<span className="ncnt"></span>/<span className="mcnt">100</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

Inventory.propTypes = {
};

Inventory.defaultProps = {
};
