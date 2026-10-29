'use client';

import { Radio, RadioGroup } from '@/shared/ui/Radio';
import CustomIcon, { CustomIconName } from '@/shared/ui/CustomIcon';
import clsx from 'clsx';
import { CreateDetailPageTogglesValue } from '@/shared/types/ui/toggles';

const pageCreationOptions = [
  {
    value: 'keyword',
    title: '키워드 선택',
    description1: '제품의 특징을 나타내는',
    description2: '키워드를 선택하세요.',
    backgroundImage: 'keyword-btn-bg',
    imageClassName: 'right-1 bottom-0',
    imageWidth: 147.64,
    imageHeight: 117.36,
  },
  {
    value: 'image',
    title: '이미지 업로드',
    description1: '벤치마킹 할 상세페이지를',
    description2: '전체 캡처해서 올려주세요.',
    backgroundImage: 'select-template',
    imageClassName: 'right-0 bottom-1/2 translate-y-1/2 right-4',
    imageWidth: 88,
    imageHeight: 92.77,
  },
];

interface PageCreationMethodSelectorProps {
  selectedMethod: string;
  onMethodChange: (method: CreateDetailPageTogglesValue) => void;
}

export default function PageCreationMethodSelector({
  selectedMethod,
  onMethodChange,
}: PageCreationMethodSelectorProps) {
  return (
    <RadioGroup label="상세페이지 생성 방식 선택" className="grid sm:grid-cols-2 gap-6">
      {pageCreationOptions.map((option) => {
        const isSelected = selectedMethod === option.value;
        const labelClassName = clsx(
          'rounded-lg px-4 py-6.25 border relative h-[8.75rem]',
          isSelected
            ? 'border-(--color-point) shadow-(--blue-shadow)'
            : 'border-(--color-gray-100)',
        );

        return (
          <Radio
            checked={isSelected}
            key={option.value}
            name="page-creation-method"
            value={option.value}
            className={'btn-radio'}
            labelClassName={labelClassName}
            onChange={(e) => onMethodChange(e.target.value as CreateDetailPageTogglesValue)}
          >
            {option.backgroundImage && (
              <CustomIcon
                name={option.backgroundImage as CustomIconName}
                width={option.imageWidth}
                height={option.imageHeight}
                className={clsx(
                  option.imageClassName,
                  'absolute',
                  isSelected ? 'text-(--color-point)' : 'text-[#6b7280]',
                )}
              />
            )}
            <p className="pt-3">{option.title}</p>
            <p className="description text-gray-300 pt-2">{option.description1}</p>
            <p className="description text-gray-300">{option.description2}</p>
          </Radio>
        );
      })}
    </RadioGroup>
  );
}
