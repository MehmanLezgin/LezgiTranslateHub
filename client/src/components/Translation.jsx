import React from 'react'

export default function RateTranslation({ index, isSingle, translationItem, textChangeCallback, removeCallback, dialectCallback, disableField = false, disableRemove = false }) {
    const { text, is_dialect } = translationItem;

    return (
        <div style={
            {
                display: 'flex',
                flexWrap: 'nowrap'
            }
        }>
            {!isSingle && !disableRemove ? <button type='button' onClick={() => removeCallback(index)}>-X-</button> : <></>}
            <input 
                type="text" 
                defaultValue={text} 
                disabled={disableField} 
                placeholder='Перевод'
                onChange={(e) => textChangeCallback(index, e.target.value)}
            />
            <input type='checkbox' onChange={e => dialectCallback(index, e.target.checked)} checked={is_dialect} disabled={disableField} />
        </div>
    )
}
