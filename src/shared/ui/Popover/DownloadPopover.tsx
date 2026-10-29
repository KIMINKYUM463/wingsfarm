'use client';

import { useState } from 'react';
import Dropdown from '@/shared/ui/Dropdown';
import Icon, { IconName } from '@/shared/ui/Icon';
// TODO: 지정 페이지 기능 구현 시 주석 해제
// import Input from '@/shared/ui/Input/Input';
import { useImageDownload } from '@/features/editor/hooks/useImageDownload';
import Button from '@/shared/ui/Button/Button';

const DownloadPopover = () => {
  const [selectedPageId, setSelectedPageId] = useState('single');
  const [selectedFormat, setSelectedFormat] = useState('jpg');
  const {
    downloadAllPagesAsPng,
    downloadAllPagesAsJpg,
    downloadIndividualAsPng,
    downloadIndividualAsJpg,
    isDownloading,
  } = useImageDownload();
  const fileFormatOptions: {
    label: string;
    id: string;
    description: string;
    icon: IconName;
  }[] = [
    // {
    //   label: 'PDF 표준',
    //   id: 'pdf-standard',
    //   description: '문서에 적합한 범용 파일',
    //   icon: 'description',
    // },
    // {
    //   label: 'PDF 인쇄',
    //   id: 'pdf-print',
    //   description: '벡터를 포함하는 인쇄용 파일',
    //   icon: 'description',
    // },
    {
      label: 'JPG',
      id: 'jpg',
      description: '손실 압축 이미지 파일',
      icon: 'photo',
    },
    {
      label: 'PNG',
      id: 'png',
      description: '배경이 투명한 고품질 이미지',
      icon: 'photo',
    },
    // {
    //   label: 'PPTX',
    //   id: 'pptx',
    //   description: 'Microsoft 파워포인트 파일',
    //   icon: 'live_tv',
    // },
  ];

  const pageOptions = [
    {
      label: '한 장의 이미지',
      id: 'single',
      description: '상세페이지 전체를 한 장의 이미지로 출력합니다.',
    },
    {
      label: '개별 이미지',
      id: 'individual',
      description: '각 페이지를 한 장씩 개별 이미지로 출력합니다.',
    },
    // TODO: 지정 페이지 기능 구현 시 주석 해제
    // {
    //   label: '지정 페이지',
    //   id: 'custom',
    //   description: '직접 지정한 페이지만 출력합니다. 예)1-3',
    // },
  ];

  return (
    <div className="flex-column h-185 w-92.5 rounded-xl p-6">
      <div className="flex-1">
        <h2 className="title-1-bold mb-6">다운로드</h2>

        {/* 파일 형식 */}
        <div className="mb-8">
          <p className="pb-4">파일 형식</p>
          <Dropdown
            options={fileFormatOptions}
            initialId="jpg"
            buttonClassName="justify-start"
            dropdownListClassName="dropdown-list w-full"
            onChangeOption={(option) => setSelectedFormat(option.id)}
            renderOption={(option, isSelected) => (
              <div className={'flex w-full items-center justify-between gap-2 px-2 py-1.5'}>
                <Icon name={option.icon} width={28} height={28} />
                <div className="flex-1">
                  <p>{option.label}</p>
                  <p className="text-gray-300">{option.description}</p>
                </div>
                {isSelected && <Icon name="check" color="var(--color-point)" />}
              </div>
            )}
          />
        </div>
        {/* 페이지 선택 */}
        <div>
          <p className="mb-4">페이지 선택</p>
          <Dropdown
            options={pageOptions}
            initialId="single"
            buttonClassName="justify-start"
            dropdownListClassName="dropdown-list w-full"
            onChangeOption={(option) => setSelectedPageId(option.id)}
            renderOption={(option, isSelected) => (
              <div className="flex w-full items-center justify-between">
                <div>
                  <p>{option.label}</p>
                  <p className="text-gray-300">{option.description}</p>
                </div>
                {isSelected && <Icon name="check" color="var(--color-point)" />}
              </div>
            )}
          />
          {/* TODO: 지정 페이지 기능 구현 시 주석 해제
          {selectedPageId === 'custom' && (
            <Input
              placeholder="예) 1-3"
              className="ho mt-3 h-(--btn-h) w-full rounded-lg border border-gray-100 bg-white px-(--control-x) hover:border-(--color-point) focus:border-(--color-point)"
            />
          )} */}
          {/* <div className="mt-3">
            <LabeledCheckbox
              text="한 장의 이미지로 합치기"
              size={4}
              labelClassName="gap-[0.375rem]"
              textClassName="text-[var(--color-gray-400)]"
            />
          </div> */}
        </div>
      </div>
      {/* 중국어 번역 옵션 */}
      {/* <LabeledCheckbox
        text="중국어 번역본 함께 받기"
        size={4}
        labelClassName="gap-[0.375rem]"
        textClassName="text-[var(--color-gray-400)]"
      /> */}
      <Button
        className="btn-primary mt-3 w-full"
        onClick={() => {
          const downloadActions: Record<string, Record<string, () => void>> = {
            single: { png: downloadAllPagesAsPng, jpg: downloadAllPagesAsJpg },
            individual: { png: downloadIndividualAsPng, jpg: downloadIndividualAsJpg },
          };

          const action = downloadActions[selectedPageId]?.[selectedFormat];
          if (action) {
            action();
            return;
          }
        }}
        isLoading={isDownloading}
        disabled={isDownloading}
      >
        <span className="p-bold">다운로드</span>
      </Button>
    </div>
  );
};

export default DownloadPopover;
