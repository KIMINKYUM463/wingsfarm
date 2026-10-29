'use client';

import { useState, useRef } from 'react';
import Button from '@/shared/ui/Button/Button';
import Icon from '@/shared/ui/Icon';
import ModalContent from '../ModalContent';
import type { ModalComponentProps } from '../types';

const ImageUploadModal = ({ data, onClose }: ModalComponentProps) => {
  const onUpload = data?.onUpload as ((files: File[]) => void) | undefined;
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    setSelectedFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    setSelectedFiles(files);

    // input 값 초기화 (같은 파일 재선택 가능하도록)
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleConfirmUpload = () => {
    if (selectedFiles.length > 0) {
      onUpload?.(selectedFiles);
      onClose();
    }
  };

  return (
    <ModalContent
      onClose={onClose}
      showCloseButton={false}
      className="bg-white p-6 space-y-6 rounded-lg w-full max-w-md"
    >
      {/* 제목 */}
      <h3 className="h3-bold">이미지 업로드</h3>

      {/* 드래그앤드롭 영역 */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleUploadClick}
        className={`
          border-2 border-dashed rounded-lg p-12 text-center space-y-4 cursor-pointer
          transition-colors
          ${isDragging ? 'border-(--color-point) bg-[#F9FBFD]' : 'border-gray-200 bg-gray-50'}
        `}
      >
        <Icon name="folder" width={48} height={48} className="mx-auto text-gray-300" />
        <p className="text-gray-400">
          {isDragging
            ? '파일을 여기에 드롭하세요'
            : '파일을 드래그 앤 드롭 하거나 아래 파일 선택 버튼을 클릭하세요'}
        </p>
      </div>

      {/* 선택된 파일 목록 */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">선택된 파일:</p>
          {selectedFiles.map((file, index) => (
            <div key={index} className="flex items-center p-2 bg-gray-50 rounded-lg">
              <Icon name="image" width={16} height={16} className="mr-2 text-gray-500" />
              <span className="text-sm text-gray-700 flex-1 truncate">{file.name}</span>
              <button
                onClick={() => setSelectedFiles((prev) => prev.filter((_, i) => i !== index))}
                className="ml-2 text-gray-400 hover:text-red-500"
              >
                <Icon name="close" width={16} height={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 버튼 그룹 */}
      <div className="flex gap-4.25 w-full">
        <Button onClick={onClose} className="flex-1 btn-cancel">
          <span className="title-1-bold p">취소</span>
        </Button>
        <Button onClick={handleUploadClick} className="flex-1 btn-secondary">
          <span className="title-1-bold p">파일 선택</span>
        </Button>
        {selectedFiles.length > 0 && (
          <Button onClick={handleConfirmUpload} className="flex-1 btn-primary">
            <span className="title-1-bold p">업로드</span>
          </Button>
        )}
      </div>

      {/* 숨겨진 file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
    </ModalContent>
  );
};

export default ImageUploadModal;
