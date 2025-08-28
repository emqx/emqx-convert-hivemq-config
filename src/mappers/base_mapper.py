from abc import ABC, abstractmethod


class BaseMapper(ABC):
    @abstractmethod
    def map(self, element):
        pass
