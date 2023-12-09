import React from 'react'
import Translation from './Translation'
import Username from './Username';

export default function RateTranslation({ index, mark, isSingle, translationItem, textChangeCallback, suggChangeCallback, removeCallback, rateCallback, dialectCallback }) {
    const { id, translator_username, rating, rates_count, can_suggest } = translationItem;

    const factor = mark / 5;
    const red = [255, 181, 181];
    const green = [192, 255, 181];

    const interpolatedColor = red.map((channel, index) => {
        const minChannel = channel;
        const maxChannel = green[index];
        const interpolatedValue = minChannel + factor * (maxChannel - minChannel);
        return Math.round(interpolatedValue);
    });

    // Convert interpolated color to RGB format
    const markColor = mark < 1 ? '#00000000' : `rgb(${interpolatedColor[0]}, ${interpolatedColor[1]}, ${interpolatedColor[2]})`;


    return (
        <div style={
            {
                display: 'flex',
                flexWrap: 'nowrap'
            }
        }>
            <Translation
                key={index}
                index={index}
                textChangeCallback={textChangeCallback}
                isSingle={isSingle}
                removeCallback={removeCallback}
                translationItem={translationItem}
                disableField={true}
                dialectCallback={dialectCallback}
                disableRemove={true}
            />
            <p>|</p>
            {can_suggest ?
                <input
                    type="text"
                    placeholder='Предложите перевод'
                    disabled={!can_suggest && id != undefined}
                    onChange={(e) => suggChangeCallback(index, e.target.value)}
                /> : <></>}

            <select onChange={(e) => rateCallback(index, e.target.selectedIndex)} style={{ backgroundColor: markColor }}>
                <option value="none">Оценка</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
            </select>
            <p>Рейтинг: {rating}, Оценок: {rates_count > 0 ? rates_count : 'Нет'}, Перевёл: <Username username={translator_username} /> </p>
        </div>
    )
}
