export default function Spinner({size = 'md', color = 'blue', label = 'Loading Dashboard...'}) {
    const sizeClasses = {
        sm: 'w-4 h-4 border-2',
        md: 'w-6 h-6 border-2',
        lg: 'w-10 h-10 border-[3px]',
    };

    const colorClasses = {
        blue: 'border-blue-500',
        red: 'border-red-500',
        green: 'border-green-500',
        gray: 'border-gray-500',
        purple: 'border-purple-500',
    };

    return (
        <div className="font-semibold text-gray-500 flex items-center justify-center gap-3">
            <div
                className={`${sizeClasses[size] ?? sizeClasses.md} ${colorClasses[color] ?? colorClasses.blue} border-t-transparent rounded-full animate-spin`}
            />
            {label}
        </div>
    );
}